import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { bomLinks } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const url = new URL(context.request.url);
  const partName = url.searchParams.get('partName');

  if (!partName) {
    return new Response(JSON.stringify({ error: 'partName query param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await db.select().from(bomLinks).where(eq(bomLinks.partName, partName)).all();

  return new Response(JSON.stringify({ links: rows, cached: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const body = await context.request.json();
    const { partName, partDescription, targetPrice, refresh } = body;

    if (!partName || typeof partName !== 'string') {
      return new Response(JSON.stringify({ error: 'partName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check cache unless refresh is requested
    if (!refresh) {
      const cached = await db.select().from(bomLinks).where(eq(bomLinks.partName, partName)).all();
      if (cached.length > 0) {
        const fetchedAt = new Date(cached[0].fetchedAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (fetchedAt > sevenDaysAgo) {
          return new Response(JSON.stringify({ links: cached, cached: true }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Check for API key
    const apiKey = context.locals.runtime.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service unavailable', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Claude API
    let Anthropic: any;
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI service unavailable', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are a hardware procurement assistant. Given an electronic component name and description, suggest purchase links from major suppliers. Return ONLY valid JSON array with this exact structure:
[
  { "supplier": "Amazon", "url": "https://amazon.com/dp/...", "price": "$XX.XX", "rating": 46, "confidence": "high" },
  { "supplier": "AliExpress", "url": "https://aliexpress.com/item/...", "price": "$XX.XX", "rating": 40, "confidence": "medium" }
]
Confidence levels: "high" = exact match found, "medium" = close match, "low" = general category.
Rating must be an integer from 10 to 50 representing a 1.0 to 5.0 star rating in tenths.
Only include suppliers where you're reasonably confident the product exists. Target price is approximately $${targetPrice ?? 0}.`,
      messages: [
        {
          role: 'user',
          content: `Find purchase links for: ${partName} - ${partDescription || ''}`,
        },
      ],
    });

    // Parse JSON from Claude's response
    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock) {
      return new Response(
        JSON.stringify({ error: 'AI service unavailable', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    let parsedLinks: any[];
    try {
      // Try to extract JSON array from the response text
      const text = (textBlock as any).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      parsedLinks = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clear old cached links for this part
    await db.delete(bomLinks).where(eq(bomLinks.partName, partName)).run();

    // Cache results
    const now = new Date().toISOString();
    const savedLinks = [];
    for (const link of parsedLinks) {
      const row = await db
        .insert(bomLinks)
        .values({
          partName,
          supplier: link.supplier || 'Unknown',
          url: link.url || '#',
          price: link.price || null,
          rating: Number.isFinite(Number(link.rating)) ? Math.max(10, Math.min(50, Math.round(Number(link.rating)))) : null,
          confidence: link.confidence || 'low',
          fetchedAt: now,
        })
        .returning()
        .get();
      savedLinks.push(row);
    }

    return new Response(JSON.stringify({ links: savedLinks, cached: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('BOM links API error:', err);
    return new Response(
      JSON.stringify({ error: 'AI service unavailable', links: [] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};
