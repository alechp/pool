import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { buildSessions } from '../../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id!);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
    }

    const row = db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();
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

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id!);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
    }

    const existing = db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    if (body.status !== undefined) updates.status = body.status;
    if (body.hubTypeId !== undefined) updates.hubTypeId = body.hubTypeId;
    if (body.hubTierId !== undefined) updates.hubTierId = body.hubTierId;
    if (body.sensorTierId !== undefined) updates.sensorTierId = body.sensorTierId;
    if (body.qty !== undefined) updates.qty = body.qty;

    db.update(buildSessions).set(updates).where(eq(buildSessions.id, id)).run();

    const updated = db.select().from(buildSessions).where(eq(buildSessions.id, id)).get();

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
