import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import { savedConfigs, hubTypes, hubTiers, sensorTiers } from '../../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const id = parseInt(context.params.id!);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const row = await db.select().from(savedConfigs).where(eq(savedConfigs.id, id)).get();
  if (!row) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const ht = await db.select().from(hubTypes).where(eq(hubTypes.id, row.hubTypeId)).get();
  const hubTier = row.hubTierId
    ? await db.select().from(hubTiers).where(eq(hubTiers.id, row.hubTierId)).get()
    : null;
  const st = await db.select().from(sensorTiers).where(eq(sensorTiers.id, row.sensorTierId)).get();

  return new Response(JSON.stringify({
    id: row.id,
    name: row.name,
    hubType: ht ? { id: ht.id, name: ht.name } : null,
    hubTier: hubTier ? { id: hubTier.id, name: hubTier.name, price: hubTier.price / 100 } : null,
    sensorTier: st ? { id: st.id, name: st.name, price: st.price / 100 } : null,
    qty: row.qty,
    totalCost: (hubTier ? hubTier.price / 100 : 0) + (st ? (st.price / 100) * row.qty : 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const id = parseInt(context.params.id!);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });
  }

  const existing = await db.select().from(savedConfigs).where(eq(savedConfigs.id, id)).get();
  if (!existing) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }

  const body = await context.request.json();
  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.length === 0 || body.name.length > 100) {
      return new Response(JSON.stringify({ error: 'Name must be 1-100 chars' }), { status: 400 });
    }
    updates.name = body.name;
  }

  if (body.qty !== undefined) {
    if (typeof body.qty !== 'number' || body.qty < 1 || body.qty > 8) {
      return new Response(JSON.stringify({ error: 'qty must be 1-8' }), { status: 400 });
    }
    updates.qty = body.qty;
  }

  if (body.hubTypeId !== undefined) updates.hubTypeId = body.hubTypeId;
  if (body.hubTierId !== undefined) updates.hubTierId = body.hubTierId;
  if (body.sensorTierId !== undefined) updates.sensorTierId = body.sensorTierId;

  await db.update(savedConfigs).set(updates).where(eq(savedConfigs.id, id)).run();

  const updated = await db.select().from(savedConfigs).where(eq(savedConfigs.id, id)).get();

  return new Response(JSON.stringify(updated), {
    headers: { 'Content-Type': 'application/json' },
  });
};
