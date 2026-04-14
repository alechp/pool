import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import { buildSessions } from '../../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const id = parseInt(context.params.id!);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
    }

    const row = await db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();
    if (!row) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(row), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const id = parseInt(context.params.id!);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
    }

    const existing = await db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    const body = await context.request.json();
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (body.status !== undefined) updates.status = body.status;
    if (body.hubTypeId !== undefined) updates.hubTypeId = body.hubTypeId;
    if (body.hubTierId !== undefined) updates.hubTierId = body.hubTierId;
    if (body.sensorTierId !== undefined) updates.sensorTierId = body.sensorTierId;
    if (body.qty !== undefined) updates.qty = body.qty;

    await db.update(buildSessions).set(updates).where(eq(buildSessions.id, id)).run();

    const updated = await db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();

    return new Response(JSON.stringify(updated), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
