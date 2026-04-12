import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { customBuilds, customBuildParts } from '../../lib/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const builds = await db.select().from(customBuilds).orderBy(desc(customBuilds.createdAt)).all();

    const result = await Promise.all(builds.map(async (build) => {
      const parts = await db.select().from(customBuildParts)
        .where(eq(customBuildParts.customBuildId, build.id))
        .orderBy(customBuildParts.sortOrder)
        .all();

      return {
        ...build,
        totalPrice: build.totalPrice / 100,
        parts: parts.map(p => ({
          ...p,
          price: p.price / 100,
        })),
      };
    }));

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch custom builds' }), {
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
    const { name, hubTypeId, sensorQty, totalPrice, parts } = body;

    if (!name || typeof name !== 'string' || name.length > 100) {
      return new Response(JSON.stringify({ error: 'Name is required (max 100 chars)' }), { status: 400 });
    }
    if (!hubTypeId || typeof hubTypeId !== 'string') {
      return new Response(JSON.stringify({ error: 'hubTypeId is required' }), { status: 400 });
    }
    if (!sensorQty || typeof sensorQty !== 'number' || sensorQty < 1) {
      return new Response(JSON.stringify({ error: 'sensorQty must be a positive number' }), { status: 400 });
    }
    if (totalPrice === undefined || typeof totalPrice !== 'number') {
      return new Response(JSON.stringify({ error: 'totalPrice is required' }), { status: 400 });
    }
    if (!Array.isArray(parts) || parts.length === 0) {
      return new Response(JSON.stringify({ error: 'parts array is required and must not be empty' }), { status: 400 });
    }

    const now = new Date().toISOString();

    // Insert the custom build first
    const build = await db.insert(customBuilds).values({
      name,
      hubTypeId,
      sensorQty,
      totalPrice: Math.round(totalPrice * 100),
      createdAt: now,
      updatedAt: now,
    }).returning().get();

    // Insert all parts with the custom build ID
    for (const part of parts) {
      await db.insert(customBuildParts).values({
        customBuildId: build.id,
        partType: part.partType,
        partName: part.partName,
        partDescription: part.partDescription,
        price: Math.round(part.price * 100),
        sortOrder: part.sortOrder,
      }).run();
    }

    // Fetch inserted parts to return with the build
    const insertedParts = await db.select().from(customBuildParts)
      .where(eq(customBuildParts.customBuildId, build.id))
      .orderBy(customBuildParts.sortOrder)
      .all();

    return new Response(JSON.stringify({
      ...build,
      totalPrice: build.totalPrice / 100,
      parts: insertedParts.map(p => ({
        ...p,
        price: p.price / 100,
      })),
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create custom build' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const d1 = context.locals.runtime.env.DB;
    const db = getDb(d1);

    const body = await context.request.json();
    const { id } = body;

    if (!id || typeof id !== 'number') {
      return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
    }

    const existing = await db.select().from(customBuilds).where(eq(customBuilds.id, id)).get();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    // Delete parts first (foreign key constraint)
    await db.delete(customBuildParts).where(eq(customBuildParts.customBuildId, id)).run();

    // Then delete the build
    await db.delete(customBuilds).where(eq(customBuilds.id, id)).run();

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to delete custom build' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
