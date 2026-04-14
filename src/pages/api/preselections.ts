import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { preselections } from '../../lib/schema';
import { desc } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const rows = await db.select().from(preselections).orderBy(desc(preselections.createdAt)).limit(50).all();

    return new Response(JSON.stringify(rows), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch preselections' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const body = await context.request.json();
    const { hubTypeId, hubTierId, sensorTierId, source } = body;

    if (!hubTypeId || typeof hubTypeId !== 'string') {
      return new Response(JSON.stringify({ error: 'hubTypeId is required' }), { status: 400 });
    }
    if (!sensorTierId || typeof sensorTierId !== 'string') {
      return new Response(JSON.stringify({ error: 'sensorTierId is required' }), { status: 400 });
    }
    if (!source || typeof source !== 'string') {
      return new Response(JSON.stringify({ error: 'source is required' }), { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await db.insert(preselections).values({
      hubTypeId,
      hubTierId: hubTierId || null,
      sensorTierId,
      source,
      convertedToSave: 0,
      createdAt: now,
    }).returning().get();

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create preselection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
