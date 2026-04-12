import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { bomSelections } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const url = new URL(context.request.url);
  const buildKey = url.searchParams.get('buildKey');

  if (!buildKey) {
    return new Response(JSON.stringify({ error: 'buildKey query param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = await db.select().from(bomSelections).where(eq(bomSelections.buildKey, buildKey)).all();

  return new Response(JSON.stringify({ selections: rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const body = await context.request.json();
  const { buildKey, filterMode, selections } = body;

  if (!buildKey || typeof buildKey !== 'string') {
    return new Response(JSON.stringify({ error: 'buildKey is required' }), { status: 400 });
  }

  if (!['cheapest', 'most-expensive', 'highest-rating'].includes(filterMode)) {
    return new Response(JSON.stringify({ error: 'Invalid filterMode' }), { status: 400 });
  }

  if (!Array.isArray(selections)) {
    return new Response(JSON.stringify({ error: 'selections array is required' }), { status: 400 });
  }

  await db.delete(bomSelections).where(eq(bomSelections.buildKey, buildKey)).run();

  const now = new Date().toISOString();
  const saved = [];
  for (const selection of selections as any[]) {
    const row = await db.insert(bomSelections).values({
      buildKey,
      partName: selection.partName,
      selectedUrl: selection.selectedUrl,
      selectedSupplier: selection.selectedSupplier || null,
      selectionSource: selection.selectionSource,
      filterMode,
      updatedAt: now,
    }).returning().get();
    saved.push(row);
  }

  return new Response(JSON.stringify({ saved }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
