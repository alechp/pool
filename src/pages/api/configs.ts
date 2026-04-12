import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { savedConfigs, hubTypes, hubTiers, sensorTiers } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const rows = await db.select().from(savedConfigs).all();

  const result = await Promise.all(rows.map(async (row) => {
    const ht = await db.select().from(hubTypes).where(eq(hubTypes.id, row.hubTypeId)).get();
    const hubTier = row.hubTierId
      ? await db.select().from(hubTiers).where(eq(hubTiers.id, row.hubTierId)).get()
      : null;
    const st = await db.select().from(sensorTiers).where(eq(sensorTiers.id, row.sensorTierId)).get();

    return {
      id: row.id,
      name: row.name,
      hubType: ht ? { id: ht.id, name: ht.name } : null,
      hubTier: hubTier ? { id: hubTier.id, name: hubTier.name, price: hubTier.price / 100 } : null,
      sensorTier: st ? { id: st.id, name: st.name, price: st.price / 100 } : null,
      qty: row.qty,
      totalCost: (hubTier ? hubTier.price / 100 : 0) + (st ? (st.price / 100) * row.qty : 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }));

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const body = await context.request.json();
  const { name, hubTypeId, hubTierId, sensorTierId, qty } = body;

  // Validation
  if (!name || typeof name !== 'string' || name.length > 100) {
    return new Response(JSON.stringify({ error: 'Name is required (max 100 chars)' }), { status: 400 });
  }
  if (!hubTypeId) {
    return new Response(JSON.stringify({ error: 'hubTypeId is required' }), { status: 400 });
  }
  if (!sensorTierId) {
    return new Response(JSON.stringify({ error: 'sensorTierId is required' }), { status: 400 });
  }
  if (!qty || typeof qty !== 'number' || qty < 1 || qty > 8) {
    return new Response(JSON.stringify({ error: 'qty must be 1-8' }), { status: 400 });
  }

  // Verify hub type exists
  const ht = await db.select().from(hubTypes).where(eq(hubTypes.id, hubTypeId)).get();
  if (!ht) {
    return new Response(JSON.stringify({ error: 'Invalid hubTypeId' }), { status: 400 });
  }

  // Verify hub tier if provided
  if (hubTypeId !== 'none') {
    if (!hubTierId) {
      return new Response(JSON.stringify({ error: 'hubTierId required for non-standalone' }), { status: 400 });
    }
    const tier = await db.select().from(hubTiers).where(eq(hubTiers.id, hubTierId)).get();
    if (!tier || tier.hubTypeId !== hubTypeId) {
      return new Response(JSON.stringify({ error: 'Invalid hubTierId' }), { status: 400 });
    }
  }

  // Verify sensor tier
  const st = await db.select().from(sensorTiers).where(eq(sensorTiers.id, sensorTierId)).get();
  if (!st || st.hubTypeId !== hubTypeId) {
    return new Response(JSON.stringify({ error: 'Invalid sensorTierId' }), { status: 400 });
  }

  const now = new Date().toISOString();
  const result = await db.insert(savedConfigs).values({
    name,
    hubTypeId,
    hubTierId: hubTypeId === 'none' ? null : hubTierId,
    sensorTierId,
    qty,
    createdAt: now,
    updatedAt: now,
  }).returning().get();

  return new Response(JSON.stringify(result), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const body = await context.request.json();
  const { id } = body;

  if (!id || typeof id !== 'number') {
    return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
  }

  const existing = await db.select().from(savedConfigs).where(eq(savedConfigs.id, id)).get();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  await db.delete(savedConfigs).where(eq(savedConfigs.id, id)).run();

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
