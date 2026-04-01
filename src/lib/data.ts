export type HubType = {
  id: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  specs: string[];
};

export type HubTier = {
  id: string;
  hubTypeId: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  price: number;
  specs: string[];
};

export type SensorTier = {
  id: string;
  hubTypeId: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  price: number;
  battery: string;
  commRange: string;
  accentColor: string;
  specs: string[];
};

export type Part = {
  id: number;
  name: string;
  description: string;
  price: number;
  sortOrder: number;
};

export type SavedConfig = {
  id: number;
  name: string;
  hubTypeId: string;
  hubTierId: string | null;
  sensorTierId: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
};

export type Catalog = {
  hubTypes: HubType[];
  hubTiers: HubTier[];
  sensorTiers: SensorTier[];
  hubParts: Record<string, Part[]>;
  sensorParts: Record<string, Part[]>;
};

export type BuildCombo = {
  hubType: HubType;
  hubTier: HubTier | null;
  sensorTier: SensorTier;
  hubCost: number;
  sensorCost: number;
  totalAtFour: number;
  battery: string;
  commRange: string;
  partCount: number;
  hubParts: Part[];
  sensorParts: Part[];
};

export function buildCombos(catalog: Catalog): BuildCombo[] {
  const combos: BuildCombo[] = [];

  for (const ht of catalog.hubTypes) {
    const tiers = catalog.hubTiers.filter(t => t.hubTypeId === ht.id);
    const sensors = catalog.sensorTiers.filter(s => s.hubTypeId === ht.id);

    if (ht.id === 'none') {
      for (const sensor of sensors) {
        const sp = catalog.sensorParts[sensor.id] || [];
        combos.push({
          hubType: ht,
          hubTier: null,
          sensorTier: sensor,
          hubCost: 0,
          sensorCost: sensor.price,
          totalAtFour: sensor.price * 4,
          battery: sensor.battery,
          commRange: sensor.commRange,
          partCount: sp.length,
          hubParts: [],
          sensorParts: sp,
        });
      }
    } else {
      for (const tier of tiers) {
        for (const sensor of sensors) {
          const hp = catalog.hubParts[tier.id] || [];
          const sp = catalog.sensorParts[sensor.id] || [];
          combos.push({
            hubType: ht,
            hubTier: tier,
            sensorTier: sensor,
            hubCost: tier.price,
            sensorCost: sensor.price,
            totalAtFour: tier.price + sensor.price * 4,
            battery: sensor.battery,
            commRange: sensor.commRange,
            partCount: hp.length + sp.length,
            hubParts: hp,
            sensorParts: sp,
          });
        }
      }
    }
  }

  return combos;
}

export function loadCatalog(raw: {
  hubTypes: any[];
  hubTiers: any[];
  sensorTiers: any[];
  hubParts: any[];
  sensorParts: any[];
}): Catalog {
  const hubTypes: HubType[] = raw.hubTypes.map(r => ({
    ...r,
    specs: JSON.parse(r.specs),
  }));

  const hubTiers: HubTier[] = raw.hubTiers.map(r => ({
    ...r,
    price: r.price / 100,
    specs: JSON.parse(r.specs),
  }));

  const sensorTiers: SensorTier[] = raw.sensorTiers.map(r => ({
    ...r,
    price: r.price / 100,
    specs: JSON.parse(r.specs),
  }));

  const hubParts: Record<string, Part[]> = {};
  for (const p of raw.hubParts) {
    const tid = p.hubTierId;
    if (!hubParts[tid]) hubParts[tid] = [];
    hubParts[tid].push({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price / 100,
      sortOrder: p.sortOrder,
    });
  }
  for (const k of Object.keys(hubParts)) {
    hubParts[k].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const sensorParts: Record<string, Part[]> = {};
  for (const p of raw.sensorParts) {
    const tid = p.sensorTierId;
    if (!sensorParts[tid]) sensorParts[tid] = [];
    sensorParts[tid].push({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price / 100,
      sortOrder: p.sortOrder,
    });
  }
  for (const k of Object.keys(sensorParts)) {
    sensorParts[k].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return { hubTypes, hubTiers, sensorTiers, hubParts, sensorParts };
}
