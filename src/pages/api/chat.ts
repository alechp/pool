import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { hubTypes, hubTiers, sensorTiers, chatSessions } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const body = await context.request.json();
    const { messages, sessionId, image } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for API key
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

    // Load catalog data from DB
    const hubTypesData = await db.select().from(hubTypes).all();
    const hubTiersRaw = await db.select().from(hubTiers).all();
    const hubTiersData = hubTiersRaw.map((t) => ({ ...t, price: t.price / 100 }));
    const sensorTiersRaw = await db.select().from(sensorTiers).all();
    const sensorTiersData = sensorTiersRaw.map((t) => ({ ...t, price: t.price / 100 }));

    // Build system prompt with catalog data
    const systemPrompt = `You are SwimSentry's AI advisor helping users choose pool safety hardware.

Available hardware catalog:
[Hub Types]: ${JSON.stringify(hubTypesData)}
[Hub Tiers]: ${JSON.stringify(hubTiersData)}
[Sensor Tiers]: ${JSON.stringify(sensorTiersData)}

When recommending a configuration, include a JSON block in your response like this:
\`\`\`recommendation
{"hubTypeId":"zigbee","hubTierId":"zigbee-cheap","sensorTierId":"zb-cheap","qty":4,"reasoning":"..."}
\`\`\`

Consider: pool size, distance from house, budget, number of children, notification preferences, and power availability.
If the user uploads a layout, site plan, or pool image, inspect it carefully. Extract exact dimensions only when the drawing explicitly shows measurements, scale marks, or dimension labels. If exact size cannot be read directly from the image, say that clearly and identify what reference is missing rather than inventing a number.
Format the visible response in clean GitHub-flavored Markdown with short headings or bullets when useful.
Keep responses concise (2-4 sentences) unless asked for detail.`;

    // Call Groq API
    let Groq: any;
    try {
      Groq = (await import('groq-sdk')).default;
    } catch {
      return new Response(
        JSON.stringify({
          content: 'AI chat requires the Groq SDK. Please install groq-sdk.',
          recommendation: null,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new Groq({ apiKey });

    const model = 'meta-llama/llama-4-scout-17b-16e-instruct';

    const latestUserIndex = [...messages].reverse().findIndex((m: any) => m.role === 'user');
    const imageMessageIndex = latestUserIndex === -1 ? -1 : messages.length - 1 - latestUserIndex;

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

    // Parse recommendation JSON if present
    let recommendation = null;
    const recMatch = content.match(/```recommendation\s*\n?([\s\S]*?)\n?```/);
    if (recMatch) {
      try {
        recommendation = JSON.parse(recMatch[1].trim());
        if (recommendation?.hubTypeId && recommendation?.sensorTierId) {
          const hubType = await db.select().from(hubTypes).where(eq(hubTypes.id, recommendation.hubTypeId)).get();
          const hubTier = recommendation.hubTierId
            ? await db.select().from(hubTiers).where(eq(hubTiers.id, recommendation.hubTierId)).get()
            : null;
          const sensorTier = await db.select().from(sensorTiers).where(eq(sensorTiers.id, recommendation.sensorTierId)).get();

          recommendation = {
            ...recommendation,
            hubTypeName: hubType?.name ?? recommendation.hubTypeId,
            hubTierName: hubTier?.name ?? null,
            sensorTierName: sensorTier?.name ?? recommendation.sensorTierId,
          };
        }
      } catch {
        // Recommendation parsing failed, continue without it
      }
    }

    // Clean the content by removing the recommendation code block
    const cleanContent = content.replace(/```recommendation\s*\n?[\s\S]*?\n?```/g, '').trim();

    // Handle session tracking
    let currentSessionId = sessionId;
    const now = new Date().toISOString();

    if (currentSessionId) {
      // Update existing session
      await db.update(chatSessions)
        .set({
          messageCount: messages.length + 1,
          recommendationMade: recommendation ? 1 : 0,
          updatedAt: now,
        })
        .where(eq(chatSessions.id, currentSessionId))
        .run();
    } else {
      // Create new session
      const session = await db
        .insert(chatSessions)
        .values({
          messageCount: messages.length + 1,
          recommendationMade: recommendation ? 1 : 0,
          recommendationApplied: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      currentSessionId = session.id;
    }

    return new Response(
      JSON.stringify({
        content: cleanContent,
        recommendation,
        sessionId: currentSessionId,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Chat API error:', err);
    return new Response(
      JSON.stringify({
        content: 'AI chat is temporarily unavailable. Please try again later.',
        recommendation: null,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};
