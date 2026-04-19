# Migrate from Anthropic to Groq API

## Overview

Replace the Anthropic Claude SDK with the Groq SDK across all API endpoints. Groq provides an OpenAI-compatible API with significantly faster inference (1,000 tokens/sec) and lower pricing.

**Affected endpoints:**
- `src/pages/api/bom-links.ts` — BOM link generation (text-only)
- `src/pages/api/chat.ts` — AI advisor chat (text + vision/image upload)

**API key:** `op://SwimSentry/Groq/api-key` (1Password reference)

---

## Model Selection

| Use Case | Current (Anthropic) | New (Groq) | Why |
|----------|-------------------|------------|-----|
| BOM link generation | `claude-haiku-4-5-20251001` | `openai/gpt-oss-20b` | Fastest on Groq (1,000 T/s), supports strict structured outputs for guaranteed valid JSON, cheapest ($0.075/$0.30 per M tokens) |
| AI advisor chat | `claude-haiku-4-5-20251001` | `openai/gpt-oss-20b` | Same model, good for conversational tasks |
| Chat with image | `claude-haiku-4-5-20251001` (vision) | `meta-llama/llama-4-scout-17b-16e-instruct` | Only Groq model with vision support. Falls back to `gpt-oss-20b` for text-only messages |

### Pricing Comparison

| | Anthropic Haiku | Groq gpt-oss-20b | Savings |
|--|----------------|-------------------|---------|
| Input | $0.25/M | $0.075/M | 70% |
| Output | $1.25/M | $0.30/M | 76% |

---

## Dependency Changes

### Remove
```bash
# Remove Anthropic SDK (currently in package.json as "@anthropic-ai/sdk": "0.39.0")
# No uninstall needed — just remove from package.json and next install will clean it up
```

### Add
```bash
sfw bun add groq-sdk@0.15.0
```

### Environment Variables

**Remove:** `ANTHROPIC_API_KEY`
**Add:** `GROQ_API_KEY`

**Local dev (`.dev.vars`):**
```
GROQ_API_KEY=op://SwimSentry/Groq/api-key
```

**Production (Cloudflare):**
```bash
wrangler secret put GROQ_API_KEY
# Paste the resolved API key when prompted
```

**Wrangler config (`wrangler.toml`):**
Update the comment:
```diff
-# Secrets set via: wrangler secret put ANTHROPIC_API_KEY
+# Secrets set via: wrangler secret put GROQ_API_KEY
```

---

## API Format Differences

### Key differences (Anthropic → Groq/OpenAI format)

| Aspect | Anthropic | Groq |
|--------|-----------|------|
| Package | `@anthropic-ai/sdk` | `groq-sdk` |
| Import | `import Anthropic from '@anthropic-ai/sdk'` | `import Groq from 'groq-sdk'` |
| Env var | `ANTHROPIC_API_KEY` | `GROQ_API_KEY` |
| Method | `client.messages.create()` | `client.chat.completions.create()` |
| System prompt | Top-level `system` param | `{ role: 'system', content: '...' }` in messages array |
| Max tokens | `max_tokens: 1024` | `max_completion_tokens: 1024` |
| Response text | `response.content.find(b => b.type === 'text').text` | `response.choices[0].message.content` |
| JSON mode | Prompt engineering + regex parsing | `response_format: { type: 'json_schema', json_schema: {...} }` |
| Vision format | `{ type: 'image', source: { type: 'base64', media_type, data } }` | `{ type: 'image_url', image_url: { url: 'data:{mediaType};base64,{data}' } }` |

---

## File-by-File Changes

### 1. `src/pages/api/bom-links.ts`

This is the BOM link generation endpoint. Currently calls Claude Haiku with a prompt and extracts a JSON array from the response text using regex. With Groq, we can use **strict structured outputs** for guaranteed valid JSON.

#### Before (Anthropic):
```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey });

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: `You are a hardware procurement assistant...`,
  messages: [{ role: 'user', content: `Find purchase links for: ${partName}` }],
});

const textBlock = response.content.find((b: any) => b.type === 'text');
const text = (textBlock as any).text;
const jsonMatch = text.match(/\[[\s\S]*\]/);
parsedLinks = JSON.parse(jsonMatch[0]);
```

#### After (Groq with structured output):
```typescript
import Groq from 'groq-sdk';
const client = new Groq({ apiKey });

const response = await client.chat.completions.create({
  model: 'openai/gpt-oss-20b',
  max_completion_tokens: 1024,
  messages: [
    {
      role: 'system',
      content: `You are a hardware procurement assistant. Given an electronic component name and description, suggest purchase links from major suppliers. Return a JSON object with a "links" array. Each link has: supplier (string), url (string), price (string like "$XX.XX"), rating (integer 10-50 for 1.0-5.0 stars), confidence ("high"|"medium"|"low"). Only include suppliers where you're confident the product exists. Target price is approximately $${targetPrice ?? 0}.`,
    },
    {
      role: 'user',
      content: `Find purchase links for: ${partName} - ${partDescription || ''}`,
    },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'bom_links',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                supplier: { type: 'string' },
                url: { type: 'string' },
                price: { type: 'string' },
                rating: { type: 'integer' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['supplier', 'url', 'price', 'rating', 'confidence'],
              additionalProperties: false,
            },
          },
        },
        required: ['links'],
        additionalProperties: false,
      },
    },
  },
});

// With strict structured output, no regex extraction needed
const content = response.choices[0]?.message?.content;
const parsed = JSON.parse(content || '{"links":[]}');
parsedLinks = parsed.links;
```

**Benefits of strict structured output:**
- Guaranteed valid JSON (no regex extraction, no parse failures)
- Schema-enforced field names and types
- No "AI response was not valid JSON" errors
- Constrained decoding at the token level (not post-hoc validation)

### 2. `src/pages/api/chat.ts`

This is the AI advisor chat. Uses text messages and optionally base64 image uploads (pool layouts, site plans).

#### Key changes:
1. Replace SDK import and client initialization
2. Move system prompt into messages array
3. Change vision format from Anthropic to OpenAI-compatible
4. Change response extraction

#### Before (Anthropic vision format):
```typescript
{
  type: 'image',
  source: {
    type: 'base64',
    media_type: image.mediaType,
    data: image.data,
  },
}
```

#### After (Groq/OpenAI vision format):
```typescript
{
  type: 'image_url',
  image_url: {
    url: `data:${image.mediaType};base64,${image.data}`,
  },
}
```

#### Model selection for chat:
```typescript
// Use vision model when image is present, otherwise use the fast model
const model = image
  ? 'meta-llama/llama-4-scout-17b-16e-instruct'
  : 'openai/gpt-oss-20b';
```

#### Full replacement for chat.ts API call section:

```typescript
import Groq from 'groq-sdk';

const apiKey = context.locals.runtime.env.GROQ_API_KEY;
if (!apiKey) {
  return new Response(
    JSON.stringify({
      content: 'AI chat requires an API key. Add GROQ_API_KEY to your .dev.vars file.',
      recommendation: null,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

const client = new Groq({ apiKey });

// Use vision model when image is attached
const model = image
  ? 'meta-llama/llama-4-scout-17b-16e-instruct'
  : 'openai/gpt-oss-20b';

// Build messages array (system prompt is now a message)
const apiMessages: any[] = [
  { role: 'system', content: systemPrompt },
];

for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  if (image && i === imageMessageIndex && m.role === 'user') {
    apiMessages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${image.mediaType};base64,${image.data}`,
          },
        },
        {
          type: 'text',
          text: m.content,
        },
      ],
    });
  } else {
    apiMessages.push({
      role: m.role,
      content: m.content,
    });
  }
}

const response = await client.chat.completions.create({
  model,
  max_completion_tokens: 1024,
  messages: apiMessages,
});

const content = response.choices[0]?.message?.content
  || 'Sorry, I could not generate a response.';
```

### 3. `wrangler.toml`

```diff
-# Secrets set via: wrangler secret put ANTHROPIC_API_KEY
+# Secrets set via: wrangler secret put GROQ_API_KEY
```

### 4. `package.json`

```diff
  "dependencies": {
-   "@anthropic-ai/sdk": "0.39.0",
+   "groq-sdk": "0.15.0",
    "@astrojs/cloudflare": "12.2.1",
```

### 5. `.dev.vars`

```
GROQ_API_KEY=op://SwimSentry/Groq/api-key
```

### 6. Error messages (both endpoints)

Update all references to "Anthropic" or "ANTHROPIC_API_KEY" in error messages:

| Old | New |
|-----|-----|
| `ANTHROPIC_API_KEY not configured` | `GROQ_API_KEY not configured` |
| `Anthropic SDK not available` | `Groq SDK not available` |
| `AI chat requires the Anthropic SDK` | `AI chat requires the Groq SDK` |
| `Add ANTHROPIC_API_KEY to your .env file` | `Add GROQ_API_KEY to your .dev.vars file` |

---

## Groq Vision Constraints

The vision model (`meta-llama/llama-4-scout-17b-16e-instruct`) has these limits:
- **Max 5 images** per request
- **Max 4 MB** per base64 encoded request
- **Max 20 MB** per image URL request
- **Max 33 megapixels** per image
- **Preview status** — not recommended for production-critical paths

The chat endpoint currently supports single image uploads for pool layout analysis. This is within Groq's limits.

---

## Implementation Order

1. **Install `groq-sdk`** — `sfw bun add groq-sdk@0.15.0`
2. **Update `bom-links.ts`** — swap to Groq + structured outputs (biggest win: eliminates JSON parsing errors)
3. **Update `chat.ts`** — swap to Groq with dynamic model selection for vision
4. **Update `wrangler.toml`** — change secret comment
5. **Update `package.json`** — remove `@anthropic-ai/sdk`
6. **Set Cloudflare secret** — `wrangler secret put GROQ_API_KEY`
7. **Test locally** — verify BOM links generate, chat works, image upload works

## Testing Checklist

| Test | Verification |
|------|-------------|
| BOM link generation | Click "Generate selection" → links populate for all parts |
| BOM structured output | No "AI response was not valid JSON" errors in console |
| Chat text-only | Send message to AI advisor → get response |
| Chat with image | Upload pool layout → advisor references the image content |
| Error handling | Remove GROQ_API_KEY → clear error message shown per-part |
| Rate limits | Generate links for 15+ parts → no 429 errors |

## Rollback Plan

If Groq has issues, re-add `@anthropic-ai/sdk`, revert the two API files, and swap the secret back. The changes are isolated to 2 API files + 1 config file.
