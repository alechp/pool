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
    const apiKey = context.locals.runtime.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not configured — link generation unavailable', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call Groq API with structured output
    let Groq: any;
    try {
      Groq = (await import('groq-sdk')).default;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Groq SDK not available — link generation unavailable', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = new Groq({ apiKey });

    const makeRequest = async (attempt = 0): Promise<any> => {
      try {
        return await client.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_completion_tokens: 1024,
          messages: [
            {
              role: 'system',
              content: `You are a hardware procurement assistant. Given an electronic component name and description, suggest purchase links from major suppliers. Return ONLY a JSON object with a "links" array. Each link object has: supplier (string), url (string), price (string like "$XX.XX"), rating (integer 10-50 for 1.0-5.0 stars), confidence ("high"|"medium"|"low"). Only include suppliers where you're confident the product exists. Target price is approximately $${targetPrice ?? 0}.`,
            },
            {
              role: 'user',
              content: `Find purchase links for: ${partName} - ${partDescription || ''}`,
            },
          ],
          response_format: { type: 'json_object' },
        });
      } catch (err: any) {
        if (err?.status === 429 && attempt < 3) {
          const retryAfter = Number(err?.headers?.['retry-after']) || (2 ** attempt * 2);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          return makeRequest(attempt + 1);
        }
        throw err;
      }
    };

    const response = await makeRequest();

    // With strict structured output, no regex extraction needed
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'AI returned empty response', links: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    let parsedLinks: any[];
    try {
      const parsed = JSON.parse(content);
      parsedLinks = parsed.links;
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI response was not valid JSON — try refreshing', links: [] }),
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
