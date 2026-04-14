import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, type AppDatabase } from '../../lib/db';
import { hubTierParts, hubTiers, sensorTierParts, sensorTiers } from '../../lib/schema';
import {
  getHardwareExplorerAccentColors,
  type HardwareExplorerArchitecture,
  type HardwareExplorerTier,
} from '../../lib/hardwareVisuals';

type HardwareTierSelection = {
  sensorTierId: string;
  hubTierId: string | null;
};

type HardwareSummaryRow = {
  tierName: string;
  price: number;
  parts: string;
  accentColor: string;
};

type HardwareSummaryResponse = {
  sensor: HardwareSummaryRow;
  hub: HardwareSummaryRow | null;
};

const HARDWARE_TIER_SELECTIONS: Record<
  HardwareExplorerArchitecture,
  Record<HardwareExplorerTier, HardwareTierSelection>
> = {
  standalone: {
    budget: { sensorTierId: 'sa-cheap', hubTierId: null },
    premium: { sensorTierId: 'sa-premium', hubTierId: null },
  },
  zigbee: {
    budget: { sensorTierId: 'zb-cheap', hubTierId: 'zigbee-cheap' },
    premium: { sensorTierId: 'zb-premium', hubTierId: 'zigbee-premium' },
  },
  lora: {
    budget: { sensorTierId: 'lr-cheap', hubTierId: 'lora-cheap' },
    premium: { sensorTierId: 'lr-premium', hubTierId: 'lora-premium' },
  },
};

function normalizeArchitecture(value: string | null): HardwareExplorerArchitecture | null {
  switch ((value ?? 'standalone').toLowerCase()) {
    case 'standalone':
    case 'none':
    case 'wifi':
    case 'sa':
      return 'standalone';
    case 'zigbee':
      return 'zigbee';
    case 'lora':
    case 'lorawan':
      return 'lora';
    default:
      return null;
  }
}

function normalizeTier(value: string | null): HardwareExplorerTier | null {
  switch ((value ?? 'budget').toLowerCase()) {
    case 'budget':
    case 'cheap':
    case 'basic':
      return 'budget';
    case 'premium':
    case 'pro':
    case 'expensive':
      return 'premium';
    default:
      return null;
  }
}

function compactPartSummary(parts: Array<{ name: string }>) {
  return parts
    .map((part) => part.name.trim())
    .filter((name) => name.length > 0)
    .join(' · ');
}

async function buildSensorSummary(
  db: AppDatabase,
  sensorTierId: string,
  architecture: HardwareExplorerArchitecture,
  tier: HardwareExplorerTier
): Promise<HardwareSummaryRow | null> {
  const sensorTier = await db.select().from(sensorTiers).where(eq(sensorTiers.id, sensorTierId)).get();
  if (!sensorTier) return null;

  const parts = await db
    .select()
    .from(sensorTierParts)
    .where(eq(sensorTierParts.sensorTierId, sensorTier.id))
    .orderBy(sensorTierParts.sortOrder)
    .all();

  return {
    tierName: sensorTier.name,
    price: sensorTier.price,
    parts: compactPartSummary(parts),
    accentColor: getHardwareExplorerAccentColors(architecture, tier).sensor,
  };
}

async function buildHubSummary(
  db: AppDatabase,
  hubTierId: string | null,
  architecture: HardwareExplorerArchitecture,
  tier: HardwareExplorerTier
): Promise<HardwareSummaryRow | null> {
  if (!hubTierId) return null;

  const hubTier = await db.select().from(hubTiers).where(eq(hubTiers.id, hubTierId)).get();
  if (!hubTier) return null;

  const parts = await db
    .select()
    .from(hubTierParts)
    .where(eq(hubTierParts.hubTierId, hubTier.id))
    .orderBy(hubTierParts.sortOrder)
    .all();

  const accentColor = getHardwareExplorerAccentColors(architecture, tier).hub;
  return accentColor
    ? {
        tierName: hubTier.name,
        price: hubTier.price,
        parts: compactPartSummary(parts),
        accentColor,
      }
    : null;
}

export const GET: APIRoute = async (context) => {
  const d1 = context.locals.runtime.env.DB;
  const db = getDb(d1);

  const architecture = normalizeArchitecture(context.url.searchParams.get('arch'));
  if (!architecture) {
    return new Response(JSON.stringify({ error: 'Invalid arch. Expected standalone, zigbee, or lora.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tier = normalizeTier(context.url.searchParams.get('tier'));
  if (!tier) {
    return new Response(JSON.stringify({ error: 'Invalid tier. Expected budget or premium.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const selection = HARDWARE_TIER_SELECTIONS[architecture][tier];
  const sensor = await buildSensorSummary(db, selection.sensorTierId, architecture, tier);
  if (!sensor) {
    return new Response(JSON.stringify({ error: 'Sensor tier not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hub = await buildHubSummary(db, selection.hubTierId, architecture, tier);
  if (selection.hubTierId && !hub) {
    return new Response(JSON.stringify({ error: 'Hub tier not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload: HardwareSummaryResponse = {
    sensor,
    hub,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
