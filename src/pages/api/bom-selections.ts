import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { bomSelections } from '../../lib/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const buildKey = url.searchParams.get('buildKey');

  if (!buildKey) {
    return new Response(JSON.stringify({ error: 'buildKey query param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = db.select().from(bomSelections).where(eq(bomSelections.buildKey, buildKey)).all();

  return new Response(JSON.stringify({ selections: rows }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await request.json();
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

  db.delete(bomSelections).where(eq(bomSelections.buildKey, buildKey)).run();

  const now = new Date().toISOString();
  const saved = selections.map((selection: any) =>
    db.insert(bomSelections).values({
      buildKey,
      partName: selection.partName,
      selectedUrl: selection.selectedUrl,
      selectedSupplier: selection.selectedSupplier || null,
      selectionSource: selection.selectionSource,
      filterMode,
      updatedAt: now,
    }).returning().get()
  );

  return new Response(JSON.stringify({ saved }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
