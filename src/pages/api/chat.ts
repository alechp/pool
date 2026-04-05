import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { hubTypes, hubTiers, sensorTiers, chatSessions } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for API key
    const apiKey = import.meta.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          content: 'AI chat requires an API key. Add ANTHROPIC_API_KEY to your .env file.',
          recommendation: null,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load catalog data from DB
    const hubTypesData = db.select().from(hubTypes).all();
    const hubTiersData = db
      .select()
      .from(hubTiers)
      .all()
      .map((t) => ({ ...t, price: t.price / 100 }));
    const sensorTiersData = db
      .select()
      .from(sensorTiers)
      .all()
      .map((t) => ({ ...t, price: t.price / 100 }));

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
Format the visible response in clean GitHub-flavored Markdown with short headings or bullets when useful.
Keep responses concise (2-4 sentences) unless asked for detail.`;

    // Call Claude API
    let Anthropic: any;
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch {
      return new Response(
        JSON.stringify({
          content: 'AI chat requires the Anthropic SDK. Please install @anthropic-ai/sdk.',
          recommendation: null,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new Anthropic({ apiKey });

    const apiMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    // Extract text content
    const textBlock = response.content.find((b: any) => b.type === 'text');
    const content = textBlock ? (textBlock as any).text : 'Sorry, I could not generate a response.';

    // Parse recommendation JSON if present
    let recommendation = null;
    const recMatch = content.match(/```recommendation\s*\n?([\s\S]*?)\n?```/);
    if (recMatch) {
      try {
        recommendation = JSON.parse(recMatch[1].trim());
        if (recommendation?.hubTypeId && recommendation?.sensorTierId) {
          const hubType = db.select().from(hubTypes).where(eq(hubTypes.id, recommendation.hubTypeId)).get();
          const hubTier = recommendation.hubTierId
            ? db.select().from(hubTiers).where(eq(hubTiers.id, recommendation.hubTierId)).get()
            : null;
          const sensorTier = db.select().from(sensorTiers).where(eq(sensorTiers.id, recommendation.sensorTierId)).get();

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
      db.update(chatSessions)
        .set({
          messageCount: messages.length + 1,
          recommendationMade: recommendation ? 1 : 0,
          updatedAt: now,
        })
        .where(eq(chatSessions.id, currentSessionId))
        .run();
    } else {
      // Create new session
      const session = db
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
