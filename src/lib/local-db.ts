/**
 * Client-side SQLite cache layer (sql.js / WASM)
 *
 * Provides persistent local caching via IndexedDB-backed SQLite.
 * Falls back gracefully if sql.js is not available.
 */

const DB_NAME = 'swimsentry-cache';
const DB_VERSION = 1;

// Types for the cache layer
interface CachedBomLink {
  id: number;
  partName: string;
  supplier: string;
  url: string;
  price: string | null;
  rating: number | null;
  confidence: string;
  fetchedAt: string;
}

export interface EstimatedTotal {
  buildKey: string;
  totalCents: number;
  hubSubtotal: number;
  sensorSubtotal: number;
  sensorQty: number;
  computedAt: string;
}

let db: any = null;
let initPromise: Promise<any> | null = null;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS cache_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hub_types (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    badge       TEXT NOT NULL,
    badge_class TEXT NOT NULL,
    description TEXT NOT NULL,
    specs       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hub_tiers (
    id          TEXT PRIMARY KEY,
    hub_type_id TEXT NOT NULL,
    name        TEXT NOT NULL,
    badge       TEXT NOT NULL,
    badge_class TEXT NOT NULL,
    description TEXT NOT NULL,
    price       INTEGER NOT NULL,
    specs       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS hub_tier_parts (
    id           INTEGER PRIMARY KEY,
    hub_tier_id  TEXT NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    price        INTEGER NOT NULL,
    sort_order   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sensor_tiers (
    id           TEXT PRIMARY KEY,
    hub_type_id  TEXT NOT NULL,
    name         TEXT NOT NULL,
    badge        TEXT NOT NULL,
    badge_class  TEXT NOT NULL,
    description  TEXT NOT NULL,
    price        INTEGER NOT NULL,
    battery      TEXT NOT NULL,
    comm_range   TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    specs        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sensor_tier_parts (
    id              INTEGER PRIMARY KEY,
    sensor_tier_id  TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    price           INTEGER NOT NULL,
    sort_order      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bom_links (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    part_name  TEXT NOT NULL,
    supplier   TEXT NOT NULL,
    url        TEXT NOT NULL,
    price      TEXT,
    rating     INTEGER,
    confidence TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bom_links_part ON bom_links(part_name);

  CREATE TABLE IF NOT EXISTS bom_selections (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    build_key         TEXT NOT NULL,
    part_name         TEXT NOT NULL,
    selected_url      TEXT NOT NULL,
    selected_supplier TEXT,
    selection_source  TEXT NOT NULL,
    filter_mode       TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bom_sel_key ON bom_selections(build_key);

  CREATE TABLE IF NOT EXISTS estimated_totals (
    build_key       TEXT PRIMARY KEY,
    total_cents     INTEGER NOT NULL,
    hub_subtotal    INTEGER NOT NULL,
    sensor_subtotal INTEGER NOT NULL,
    sensor_qty      INTEGER NOT NULL,
    computed_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_configs (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    hub_type_id    TEXT NOT NULL,
    hub_tier_id    TEXT,
    sensor_tier_id TEXT NOT NULL,
    qty            INTEGER NOT NULL DEFAULT 4,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    table_name TEXT PRIMARY KEY,
    synced_at  TEXT NOT NULL,
    row_count  INTEGER NOT NULL DEFAULT 0
  );
`;

// ── IndexedDB persistence ──────────────────────────────────────

function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore('db');
      req.onsuccess = () => {
        const tx = req.result.transaction('db', 'readonly');
        const store = tx.objectStore('db');
        const get = store.get('main');
        get.onsuccess = () => resolve(get.result ?? null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function saveToIndexedDB(database: any): Promise<void> {
  const data = database.export();
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore('db');
      req.onsuccess = () => {
        const tx = req.result.transaction('db', 'readwrite');
        const store = tx.objectStore('db');
        store.put(data, 'main');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

// ── Database initialization ────────────────────────────────────

async function getLocalDb(): Promise<any> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const initSqlJs = (await import('sql.js')).default;
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sql.js/${file}`,
      });

      const stored = await loadFromIndexedDB();
      db = stored ? new SQL.Database(stored) : new SQL.Database();
      db.run(SCHEMA_SQL);
      await saveToIndexedDB(db);
      return db;
    } catch (err) {
      console.warn('[local-db] sql.js not available, falling back to no-op cache:', err);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

async function persist() {
  if (db) await saveToIndexedDB(db);
}

// ── BOM Links ──────────────────────────────────────────────────

export async function getCachedLinks(partName: string): Promise<CachedBomLink[]> {
  const database = await getLocalDb();
  if (!database) return [];

  const stmt = database.prepare('SELECT * FROM bom_links WHERE part_name = ?');
  stmt.bind([partName]);
  const rows: CachedBomLink[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push({
      id: row.id as number,
      partName: row.part_name as string,
      supplier: row.supplier as string,
      url: row.url as string,
      price: row.price as string | null,
      rating: row.rating as number | null,
      confidence: row.confidence as string,
      fetchedAt: row.fetched_at as string,
    });
  }
  stmt.free();
  return rows;
}

export async function setCachedLinks(partName: string, links: any[]) {
  const database = await getLocalDb();
  if (!database) return;

  database.run('DELETE FROM bom_links WHERE part_name = ?', [partName]);
  for (const link of links) {
    database.run(
      'INSERT INTO bom_links (part_name, supplier, url, price, rating, confidence, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [partName, link.supplier, link.url, link.price ?? null, link.rating ?? null, link.confidence, link.fetchedAt ?? new Date().toISOString()]
    );
  }
  await persist();
}

// ── Estimated Totals ───────────────────────────────────────────

export async function getEstimatedTotal(buildKey: string): Promise<EstimatedTotal | null> {
  const database = await getLocalDb();
  if (!database) return null;

  const stmt = database.prepare('SELECT * FROM estimated_totals WHERE build_key = ?');
  stmt.bind([buildKey]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      buildKey: row.build_key as string,
      totalCents: row.total_cents as number,
      hubSubtotal: row.hub_subtotal as number,
      sensorSubtotal: row.sensor_subtotal as number,
      sensorQty: row.sensor_qty as number,
      computedAt: row.computed_at as string,
    };
  }
  stmt.free();
  return null;
}

export async function setEstimatedTotal(buildKey: string, data: {
  totalCents: number;
  hubSubtotal: number;
  sensorSubtotal: number;
  sensorQty: number;
}) {
  const database = await getLocalDb();
  if (!database) return;

  database.run(
    `INSERT OR REPLACE INTO estimated_totals (build_key, total_cents, hub_subtotal, sensor_subtotal, sensor_qty, computed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [buildKey, data.totalCents, data.hubSubtotal, data.sensorSubtotal, data.sensorQty, new Date().toISOString()]
  );
  await persist();
}

// ── Sync Log ───────────────────────────────────────────────────

export async function getLastSyncTime(tableName: string): Promise<string | null> {
  const database = await getLocalDb();
  if (!database) return null;

  const stmt = database.prepare('SELECT synced_at FROM sync_log WHERE table_name = ?');
  stmt.bind([tableName]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row.synced_at as string;
  }
  stmt.free();
  return null;
}

export async function updateSyncLog(tableName: string, rowCount: number) {
  const database = await getLocalDb();
  if (!database) return;

  database.run(
    `INSERT OR REPLACE INTO sync_log (table_name, synced_at, row_count) VALUES (?, ?, ?)`,
    [tableName, new Date().toISOString(), rowCount]
  );
  await persist();
}

// ── Catalog Sync ───────────────────────────────────────────────

export async function syncCatalog(serverData: {
  hubTypes: any[];
  hubTiers: any[];
  hubParts: any[];
  sensorTiers: any[];
  sensorParts: any[];
}) {
  const database = await getLocalDb();
  if (!database) return;

  database.run('DELETE FROM hub_types');
  database.run('DELETE FROM hub_tiers');
  database.run('DELETE FROM hub_tier_parts');
  database.run('DELETE FROM sensor_tiers');
  database.run('DELETE FROM sensor_tier_parts');

  for (const r of serverData.hubTypes) {
    database.run('INSERT INTO hub_types VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.badge, r.badgeClass, r.description, r.specs]);
  }
  for (const r of serverData.hubTiers) {
    database.run('INSERT INTO hub_tiers VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.hubTypeId, r.name, r.badge, r.badgeClass, r.description, r.price, r.specs]);
  }
  for (const r of serverData.hubParts) {
    database.run('INSERT INTO hub_tier_parts VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.hubTierId, r.name, r.description, r.price, r.sortOrder]);
  }
  for (const r of serverData.sensorTiers) {
    database.run('INSERT INTO sensor_tiers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.hubTypeId, r.name, r.badge, r.badgeClass, r.description, r.price, r.battery, r.commRange, r.accentColor, r.specs]);
  }
  for (const r of serverData.sensorParts) {
    database.run('INSERT INTO sensor_tier_parts VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.sensorTierId, r.name, r.description, r.price, r.sortOrder]);
  }

  const totalRows = serverData.hubTypes.length + serverData.hubTiers.length + serverData.hubParts.length
    + serverData.sensorTiers.length + serverData.sensorParts.length;
  await updateSyncLog('catalog', totalRows);
  await persist();
}

// ── Clear Cache ────────────────────────────────────────────────

export async function clearCache() {
  const database = await getLocalDb();
  if (!database) return;

  database.run('DELETE FROM bom_links');
  database.run('DELETE FROM bom_selections');
  database.run('DELETE FROM estimated_totals');
  database.run('DELETE FROM sync_log');
  await persist();
}
