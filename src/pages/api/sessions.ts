import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { buildSessions } from '../../lib/schema';
import { desc } from 'drizzle-orm';

export const GET: APIRoute = async () => {
  try {
    const rows = db.select().from(buildSessions).orderBy(desc(buildSessions.createdAt)).limit(50).all();

    return new Response(JSON.stringify(rows), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch sessions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { status, source, hubTypeId, hubTierId, sensorTierId, qty } = body;

    if (!status || typeof status !== 'string') {
      return new Response(JSON.stringify({ error: 'status is required' }), { status: 400 });
    }
    if (!source || typeof source !== 'string') {
      return new Response(JSON.stringify({ error: 'source is required' }), { status: 400 });
    }

    const now = new Date().toISOString();
    const result = db.insert(buildSessions).values({
      status,
      source,
      hubTypeId: hubTypeId || null,
      hubTierId: hubTierId || null,
      sensorTierId: sensorTierId || null,
      qty: qty || null,
      createdAt: now,
      updatedAt: now,
    }).returning().get();

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
