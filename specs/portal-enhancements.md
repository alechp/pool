# Portal Enhancements Spec

## Overview

Six enhancements to the SwimSentry configurator portal:

1. **Instant navigation** — all page transitions feel instant, zero console errors
2. **Unified "Generate & Find" button** — merge "Generate selection" and "Find links for all parts" into one action
3. **Local SQLite/libsql persistence** — comprehensive caching layer so BOM data, links, and estimated totals survive sessions without re-fetching
4. **GIF loaders** — animated loading indicators while data is being fetched
5. **Fix link generation** — links stuck at "Refresh this part" / "Waiting" must actually resolve
6. **Persist estimated totals** — save computed totals per build configuration

---

## 1. Instant Navigation

### Problem

Page transitions between `/`, `/build`, `/bom`, `/personas`, and `/bom/compare` are slow (200-500ms per server logs). Console shows:
```
Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.
```

> **Note:** The "Could not establish connection" error originates from the CDSConvert browser extension (`index.ts-C8RV6QI3.js`), not our app. However, navigation should be genuinely instant regardless.

### Current State

- `astro.config.mjs` already has `prefetch: { prefetchAll: true, defaultStrategy: 'viewport' }`
- `Base.astro` already has `<ClientRouter />` (Astro View Transitions) with `transition:animate="fade"`
- Header and ChatSidebar use `transition:persist`

### Remaining Work

#### 1a. Prefetch critical routes on page load

Astro's viewport strategy only prefetches links visible in the viewport. The nav links (Home, Build, BOM) are always visible, but sub-routes like `/bom/compare`, `/build/custom`, and `/personas` may not be. Add eager prefetch hints for all nav destinations.

**File:** `src/components/Nav.astro`

Add `data-astro-prefetch="load"` to all `<a>` tags in the nav bar. This tells Astro to prefetch these routes immediately on page load, not just when they scroll into view:

```html
<a href="/" data-astro-prefetch="load">Home</a>
<a href="/build" data-astro-prefetch="load">Build</a>
<a href="/bom" data-astro-prefetch="load">BOM</a>
```

#### 1b. Ensure SolidJS islands survive view transitions

SolidJS components hydrated via `client:load` or `client:idle` may re-mount on every view transition, causing flickering and losing state. For stateful components that should persist:

- `BomWorkspace` — already uses module-level `linkCache`, but the component itself remounts. Since it reads from `linkCache` on mount this is acceptable, but we should verify no flash of empty state.
- `ChatSidebar` — already has `transition:persist`, good.
- `Configurator` (build wizard) — stores state in URL params, so remount is fine.

**Verify:** Navigate `/bom` → `/build` → `/bom` and confirm:
- No visible flash/blank frame
- `linkCache` data is restored instantly (no network requests)
- Estimated total renders immediately from cached data

#### 1c. Add transition loading indicator

Add a thin progress bar at the top of the page during view transitions to give instant visual feedback even before the next page renders:

**File:** `src/layouts/Base.astro`

```html
<style>
  @view-transition {
    navigation: auto;
  }
  ::view-transition-new(root) {
    animation: fade-in 150ms ease-out;
  }
  ::view-transition-old(root) {
    animation: fade-out 100ms ease-in;
  }
</style>
```

### Files Changed
- `src/components/Nav.astro` — add `data-astro-prefetch="load"` attributes
- `src/layouts/Base.astro` — add view transition CSS for snappy animations
- Verify: no regressions on SolidJS island hydration

### Acceptance Criteria
- Clicking any nav link navigates in < 100ms (perceived)
- No console errors from our code during navigation (CDSConvert errors are external)
- No flash of unstyled/empty content during transitions
- Back/forward browser buttons work correctly with view transitions

---

## 2. Unified "Generate & Find" Button

### Problem

The BOM workspace currently has two separate buttons with confusing semantics:
- **"Generate selection"** (green) — calls `generateSelectionBy(filterMode())` which first fetches all links, then auto-selects the best link per part based on the filter strategy
- **"Find links for all parts"** (gray) — calls `findLinksForAllParts(true)` which force-refreshes all links from the Claude API but doesn't auto-select

Users don't understand the difference. Both buttons trigger link fetching. The distinction between "finding links" and "generating a selection" is an implementation detail, not a user-facing concept.

### Solution

Merge into a single **"Generate selection"** button that:
1. Fetches/refreshes links for all parts that don't have fresh links (respects cache)
2. Auto-selects the best link per part based on the current filter mode
3. Shows a loading state while working

The user's intent is always: "give me a complete selection based on my criteria."

#### New Button Behavior

```
User clicks "Generate selection"
  → setBulkState('loading')
  → For each part:
      - If linkCache has fresh data (< 5min): use cached links
      - Else GET /api/bom-links: use D1 cached links if available
      - Else POST /api/bom-links: generate via Claude API
  → For each part: chooseLink(links, filterMode)
  → Update selectedLinks + selectionSource
  → setBulkState('loaded')
```

If the user wants to force-refresh (ignore all caches), hold Shift+Click or provide a small "Refresh all links" text button below the main button.

**File:** `src/components/BomWorkspace.tsx`

Remove the "Find links for all parts" button entirely. The "Generate selection" button already calls `generateSelectionBy()` which internally calls `findLinksForAllParts(false)`. The only difference was the `true` (force refresh) parameter.

Add a subtle "Refresh all links" link for power users:

```tsx
<div class="flex flex-col gap-3 w-full md:w-auto">
  <button
    onClick={() => void generateSelectionBy(filterMode())}
    disabled={bulkState() === 'loading'}
    class="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-bg-deep ..."
  >
    {bulkState() === 'loading' ? 'Generating...' : 'Generate selection'}
  </button>
  <button
    onClick={() => void generateSelectionBy(filterMode(), true)}  // force refresh
    disabled={bulkState() === 'loading'}
    class="text-xs text-text-tertiary hover:text-text-primary underline"
  >
    Refresh all links from scratch
  </button>
</div>
```

Update `generateSelectionBy` signature:

```tsx
async function generateSelectionBy(mode: LinkStrategy, forceRefresh = false) {
  await findLinksForAllParts(forceRefresh);
  // ... existing selection logic
}
```

### Files Changed
- `src/components/BomWorkspace.tsx` — remove "Find links for all parts" button, update `generateSelectionBy` signature, add "Refresh all links" text link

### Acceptance Criteria
- Single primary action button: "Generate selection"
- Clicking it fetches missing links AND auto-selects in one flow
- "Refresh all links from scratch" available for force-refresh
- Loading state shown during operation

---

## 3. Local SQLite/libsql Persistence Layer

### Problem

Every page load or navigation to `/bom` triggers network requests to D1 for:
- Catalog data (hub types, tiers, sensor tiers, parts) — rarely changes
- BOM links — cached 7 days server-side but re-fetched on every visit
- BOM selections — re-fetched on every visit
- Estimated totals — recomputed from scratch

The in-memory `linkCache` Map in `BomWorkspace.tsx` only survives within a single SPA session and is lost on hard refresh. `localStorage` is used for selections but not for links or catalog data.

### Solution

Add a client-side SQLite database (via `sql.js` or `@libsql/client` wasm) that mirrors the server D1 schema for read-heavy data. This provides:
- **Offline-capable** catalog browsing
- **Instant** BOM page loads from local cache
- **Persistent** across browser sessions
- **Structured** data with proper schema (not JSON blobs in localStorage)

#### Technology Choice: `sql.js` (SQLite compiled to WASM)

`sql.js` is zero-dependency, works in all browsers, and doesn't require a server. It stores the database in IndexedDB for persistence across sessions.

**Why not `@libsql/client`?** libsql's WASM client requires a server URL or embedded replica setup. For a purely client-side cache, `sql.js` is simpler.

**Install:**
```bash
sfw bun add sql.js@1.12.0
```

#### 3a. Client-Side Cache Schema

Create a new file `src/lib/local-db.ts`:

```typescript
import initSqlJs, { type Database } from 'sql.js';

const DB_NAME = 'swimsentry-cache';
const DB_VERSION = 1;

let db: Database | null = null;

export async function getLocalDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/sql.js/${file}`,
  });

  // Try to load from IndexedDB
  const stored = await loadFromIndexedDB();
  db = stored ? new SQL.Database(stored) : new SQL.Database();

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS cache_meta (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    );

    -- Mirror of server catalog (rarely changes)
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

    -- BOM links cache (mirrors server bom_links)
    CREATE TABLE IF NOT EXISTS bom_links (
      id         INTEGER PRIMARY KEY,
      part_name  TEXT NOT NULL,
      supplier   TEXT NOT NULL,
      url        TEXT NOT NULL,
      price      TEXT,
      rating     INTEGER,
      confidence TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bom_links_part ON bom_links(part_name);

    -- BOM selections (mirrors server bom_selections)
    CREATE TABLE IF NOT EXISTS bom_selections (
      id                INTEGER PRIMARY KEY,
      build_key         TEXT NOT NULL,
      part_name         TEXT NOT NULL,
      selected_url      TEXT NOT NULL,
      selected_supplier TEXT,
      selection_source  TEXT NOT NULL,
      filter_mode       TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bom_sel_key ON bom_selections(build_key);

    -- Estimated totals per build configuration
    CREATE TABLE IF NOT EXISTS estimated_totals (
      build_key    TEXT PRIMARY KEY,
      total_cents  INTEGER NOT NULL,
      hub_subtotal INTEGER NOT NULL,
      sensor_subtotal INTEGER NOT NULL,
      sensor_qty   INTEGER NOT NULL,
      computed_at  TEXT NOT NULL
    );

    -- Saved configurations (mirrors server saved_configs)
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

    -- Sync metadata: track when each table was last synced from server
    CREATE TABLE IF NOT EXISTS sync_log (
      table_name TEXT PRIMARY KEY,
      synced_at  TEXT NOT NULL,
      row_count  INTEGER NOT NULL DEFAULT 0
    );
  `);

  await saveToIndexedDB(db);
  return db;
}

// IndexedDB persistence helpers
function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('db');
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('db', 'readonly');
      const store = tx.objectStore('db');
      const get = store.get('main');
      get.onsuccess = () => resolve(get.result ?? null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

export function saveToIndexedDB(database: Database): Promise<void> {
  const data = database.export();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('db');
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('db', 'writeonly');
      const store = tx.objectStore('db');
      store.put(data, 'main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// Sync helpers
export async function syncCatalog(serverData: {
  hubTypes: any[];
  hubTiers: any[];
  hubParts: any[];
  sensorTiers: any[];
  sensorParts: any[];
}) {
  const db = await getLocalDb();
  const now = new Date().toISOString();

  // Clear and re-insert (catalog is small, full replace is fine)
  db.run('DELETE FROM hub_types');
  db.run('DELETE FROM hub_tiers');
  db.run('DELETE FROM hub_tier_parts');
  db.run('DELETE FROM sensor_tiers');
  db.run('DELETE FROM sensor_tier_parts');

  for (const row of serverData.hubTypes) {
    db.run(
      'INSERT INTO hub_types VALUES (?, ?, ?, ?, ?, ?)',
      [row.id, row.name, row.badge, row.badgeClass, row.description, row.specs]
    );
  }
  // ... similar for other tables ...

  db.run(
    `INSERT OR REPLACE INTO sync_log VALUES ('catalog', ?, ?)`,
    [now, serverData.hubTypes.length + serverData.hubTiers.length + serverData.sensorTiers.length]
  );

  await saveToIndexedDB(db);
}

export async function getCachedLinks(partName: string): Promise<any[]> {
  const db = await getLocalDb();
  const stmt = db.prepare('SELECT * FROM bom_links WHERE part_name = ?');
  stmt.bind([partName]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export async function setCachedLinks(partName: string, links: any[]) {
  const db = await getLocalDb();
  db.run('DELETE FROM bom_links WHERE part_name = ?', [partName]);
  for (const link of links) {
    db.run(
      'INSERT INTO bom_links (part_name, supplier, url, price, rating, confidence, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [partName, link.supplier, link.url, link.price, link.rating, link.confidence, link.fetchedAt]
    );
  }
  await saveToIndexedDB(db);
}

export async function getEstimatedTotal(buildKey: string): Promise<{
  totalCents: number;
  hubSubtotal: number;
  sensorSubtotal: number;
  sensorQty: number;
  computedAt: string;
} | null> {
  const db = await getLocalDb();
  const stmt = db.prepare('SELECT * FROM estimated_totals WHERE build_key = ?');
  stmt.bind([buildKey]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    return {
      totalCents: row.total_cents,
      hubSubtotal: row.hub_subtotal,
      sensorSubtotal: row.sensor_subtotal,
      sensorQty: row.sensor_qty,
      computedAt: row.computed_at,
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
  const db = await getLocalDb();
  db.run(
    `INSERT OR REPLACE INTO estimated_totals (build_key, total_cents, hub_subtotal, sensor_subtotal, sensor_qty, computed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [buildKey, data.totalCents, data.hubSubtotal, data.sensorSubtotal, data.sensorQty, new Date().toISOString()]
  );
  await saveToIndexedDB(db);
}

export async function getLastSyncTime(tableName: string): Promise<string | null> {
  const db = await getLocalDb();
  const stmt = db.prepare('SELECT synced_at FROM sync_log WHERE table_name = ?');
  stmt.bind([tableName]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    return row.synced_at;
  }
  stmt.free();
  return null;
}
```

#### 3b. Sync Strategy

| Data | Cache Duration | Sync Trigger | Invalidation |
|------|---------------|--------------|-------------|
| Catalog (hub types, tiers, parts) | 24 hours | Page load if stale | Admin deploys new seed |
| BOM links | 7 days (matches server TTL) | On fetch from server | User clicks "Refresh" |
| BOM selections | Write-through | On save | User changes selection |
| Estimated totals | Until selection changes | On `grandTotal` recompute | Selection or qty change |
| Saved configs | Write-through | On save/delete | User action |

**Flow on BOM page load:**

```
1. Check local-db for catalog data
   → If < 24h old: use local, skip server catalog queries
   → If stale or missing: fetch from server, update local-db

2. Check local-db for BOM links (by part name)
   → If local links exist and < 5min old: render immediately
   → If local links exist but 5min-7d old: render from local, background-refresh from server
   → If > 7d or missing: fetch from server (GET), store locally

3. Check local-db for estimated total
   → If exists: show immediately while recomputing
   → Recompute from current links/selections, update local-db

4. Check local-db for BOM selections
   → If exists for current buildKey: restore
   → Else: load from server, store locally
```

#### 3c. Integration with BomWorkspace.tsx

Replace the module-level `linkCache` Map with calls to `local-db.ts`:

```tsx
// BEFORE (in-memory only):
const linkCache = new Map<string, { links: BomLink[]; fetchedAt: number }>();

// AFTER (SQLite-backed):
import { getCachedLinks, setCachedLinks, getEstimatedTotal, setEstimatedTotal } from '../lib/local-db';

async function ensureLinks(part: WorkspacePart, refresh = false) {
  if (!refresh) {
    const localLinks = await getCachedLinks(part.name);
    if (localLinks.length > 0) {
      const age = Date.now() - new Date(localLinks[0].fetched_at).getTime();
      if (age < CLIENT_CACHE_TTL) {
        setLinksByPart((current) => ({ ...current, [part.name]: localLinks }));
        return;
      }
    }
  }
  // ... fetch from server, then:
  await setCachedLinks(part.name, fetchedLinks);
}
```

Persist estimated totals whenever `grandTotal` changes:

```tsx
createEffect(() => {
  const total = grandTotal();
  if (total > 0) {
    const hubTotal = rows()
      .filter(p => p.scope === 'hub')
      .reduce((sum, p) => { /* compute */ }, 0);
    const sensorTotal = total - hubTotal;
    void setEstimatedTotal(currentBuildKey(), {
      totalCents: Math.round(total * 100),
      hubSubtotal: Math.round(hubTotal * 100),
      sensorSubtotal: Math.round(sensorTotal * 100),
      sensorQty: qty(),
    });
  }
});
```

#### 3d. Estimated Totals Schema

The `estimated_totals` table (defined above) stores:

| Column | Type | Description |
|--------|------|-------------|
| `build_key` | TEXT PK | URL param string identifying the build config |
| `total_cents` | INTEGER | Grand total in cents (avoids floating point) |
| `hub_subtotal` | INTEGER | Hub parts subtotal in cents |
| `sensor_subtotal` | INTEGER | Sensor parts subtotal in cents (includes qty multiplier) |
| `sensor_qty` | INTEGER | Number of sensors at time of computation |
| `computed_at` | TEXT | ISO timestamp of last computation |

### Files Changed
- `src/lib/local-db.ts` — **new file**, SQLite WASM wrapper with schema + sync helpers
- `src/components/BomWorkspace.tsx` — replace `linkCache` Map with local-db calls, persist estimated totals
- `src/pages/bom.astro` — check local catalog cache before server queries
- `public/sql.js/` — **new directory**, copy sql.js WASM binary for static serving

### Acceptance Criteria
- Hard refresh of `/bom` page loads BOM data from local SQLite (no network for cached data)
- `estimated_totals` table contains computed totals per buildKey
- `sync_log` table tracks when each data category was last synced
- Clearing IndexedDB falls back gracefully to server fetch
- No data loss: local cache is additive, server remains source of truth

---

## 4. GIF/Animated Loaders

### Problem

Multiple loading states across the app show plain text ("Generating...", "Loading...", "Waiting") with no visual indication that work is happening. Users can't tell if the app is frozen or working.

### Solution

Add animated loading indicators for all async operations. Use CSS-animated SVG spinners (not actual GIF files) for better performance and theme consistency.

#### 4a. Create a reusable Spinner component

**File:** `src/components/Spinner.tsx`

```tsx
import type { Component } from 'solid-js';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  class?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

const Spinner: Component<Props> = (props) => (
  <div class={`inline-flex items-center gap-2 ${props.class ?? ''}`}>
    <svg
      class={`animate-spin ${sizes[props.size ?? 'sm']} text-accent`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    {props.label && <span class="text-sm text-text-secondary">{props.label}</span>}
  </div>
);

export default Spinner;
```

#### 4b. Loading states to replace

| Location | Current | New |
|----------|---------|-----|
| BOM "Generate selection" button | `"Generating..."` text | Spinner + "Generating selection..." |
| BOM per-part "Refresh this part" | No loading state | Inline spinner replacing button text |
| BOM "Waiting" in Open column | `"Waiting"` text | Small spinner |
| BOM "Available links" empty state | `"No supplier links yet"` text | Spinner + "Fetching links..." (during load) |
| Build wizard step transitions | Instant (no issue) | Keep as-is |
| "Save BOM selection" button | Instant | Brief spinner if > 200ms |

#### 4c. Skeleton rows during initial load

When BOM links are loading, show animated skeleton placeholders in the supplier/price/rating columns:

```tsx
// In BomWorkspace.tsx, where "Waiting" is shown:
<Show
  when={!loadingParts().includes(part.name)}
  fallback={
    <div class="flex items-center gap-2">
      <Spinner size="sm" />
      <span class="text-xs text-text-tertiary">Loading links...</span>
    </div>
  }
>
  {/* ... existing link display ... */}
</Show>
```

Add CSS shimmer animation for skeleton cells:

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.05) 50%, transparent 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 0.5rem;
  height: 1rem;
}
```

### Files Changed
- `src/components/Spinner.tsx` — **new file**, reusable animated spinner
- `src/components/BomWorkspace.tsx` — replace text-only loading states with Spinner
- `src/styles/global.css` — add shimmer keyframe animation

### Acceptance Criteria
- Every async operation shows an animated indicator
- No text-only loading states remain ("Generating...", "Waiting", etc.)
- Spinners match the accent color and design system
- Skeleton shimmer during initial BOM data load

---

## 5. Fix Link Generation (Stuck at "Refresh this part")

### Problem

BOM links never populate. Every part shows:
- **Open column:** "Waiting"
- **Available links section:** "No supplier links yet. Use 'Find links for all parts' or refresh this part."
- Clicking "Refresh this part" or "Find links for all parts" appears to do nothing

From server logs, the API calls ARE happening (`[200] POST /api/bom-links 190ms`) and returning successfully. The issue is on the client side.

### Root Cause Analysis

Looking at the server logs, we see rapid-fire duplicate requests:
```
13:03:28 [200] /api/bom-links 137ms
13:03:28 [200] /api/bom-links 138ms
13:03:29 [200] /api/bom-links 169ms
...
13:03:29 [200] POST /api/bom-links 190ms
13:03:29 [200] POST /api/bom-links 189ms
```

This pattern (many GETs followed by many POSTs) suggests `findLinksForAllParts` is running but the responses may be failing to parse or the state updates are being overwritten.

#### Likely causes:

**5a. Race condition in `setLinksByPart`**

In `ensureLinks()`, `setLinksByPart` is called with a spread updater:
```tsx
setLinksByPart((current) => ({ ...current, [part.name]: cachedData.links }));
```

When 10+ parts run `ensureLinks` in parallel via `Promise.all`, each call reads the `current` state at the time it resolves. If two parts resolve nearly simultaneously, the second one's spread may overwrite the first's update (stale closure over `current`).

**Fix:** SolidJS signal updaters receive the latest state, so the spread pattern should work. However, if the response JSON parsing fails silently, links would never be set.

**5b. Claude API returning empty or malformed responses**

The POST endpoint calls Claude Haiku to generate links. If the API key is missing or the response doesn't contain a valid JSON array, the endpoint returns `{ error: '...', links: [] }`. The client checks `Array.isArray(liveData.links)` but an empty array passes this check and sets empty links.

**Fix:** Add explicit error handling and logging:

```tsx
async function ensureLinks(part: WorkspacePart, refresh = false) {
  // ... existing cache check ...

  try {
    const cached = await fetch(`/api/bom-links?partName=${encodeURIComponent(part.name)}`);
    const cachedData = await cached.json();

    if (!refresh && Array.isArray(cachedData.links) && cachedData.links.length > 0) {
      setLinksByPart((current) => ({ ...current, [part.name]: cachedData.links }));
      await setCachedLinks(part.name, cachedData.links);  // persist locally
      return;
    }

    const live = await fetch('/api/bom-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partName: part.name, partDescription: part.description, targetPrice: part.price, refresh }),
    });
    const liveData = await live.json();

    // NEW: Check for errors explicitly
    if (liveData.error) {
      console.warn(`[BOM] Link generation failed for "${part.name}":`, liveData.error);
      return;  // Don't clear existing links on error
    }

    if (Array.isArray(liveData.links) && liveData.links.length > 0) {
      setLinksByPart((current) => ({ ...current, [part.name]: liveData.links }));
      await setCachedLinks(part.name, liveData.links);
    }
  } finally {
    setLoadingParts((current) => current.filter((name) => name !== part.name));
  }
}
```

**5c. `ANTHROPIC_API_KEY` not set in local dev**

The POST endpoint checks `context.locals.runtime.env.ANTHROPIC_API_KEY`. In local dev with `wrangler`, this may not be set in `.dev.vars` or `wrangler.toml`. If missing, the endpoint returns `{ error: 'AI service unavailable', links: [] }` — which the client silently accepts.

**Fix:** Add a visible error state in BomWorkspace when link generation fails:

```tsx
const [linkErrors, setLinkErrors] = createSignal<Record<string, string>>({});

// In ensureLinks, on error:
if (liveData.error) {
  setLinkErrors((current) => ({ ...current, [part.name]: liveData.error }));
  return;
}

// In the UI, show error:
<Show when={linkErrors()[part.name]}>
  <div class="mt-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
    {linkErrors()[part.name]}
  </div>
</Show>
```

**5d. Verify `.dev.vars` has the API key**

**File:** `.dev.vars` (gitignored)

```
ANTHROPIC_API_KEY=sk-ant-...
```

If this file doesn't exist or the key is invalid, link generation will always fail silently.

### Debugging Checklist

```
1. [ ] Check .dev.vars has ANTHROPIC_API_KEY
2. [ ] Check server logs for "BOM links API error:" messages
3. [ ] Add console.log in ensureLinks to trace each step:
       - Cache hit/miss
       - GET response status + link count
       - POST response status + link count
4. [ ] Verify Claude API response contains valid JSON array
5. [ ] Check if loadingParts signal is correctly being cleared
       (if ensureLinks throws, finally block may not run)
```

### Files Changed
- `src/components/BomWorkspace.tsx` — add error state, explicit error handling in `ensureLinks`
- `src/pages/api/bom-links.ts` — add more detailed error messages in responses
- `.dev.vars` — verify `ANTHROPIC_API_KEY` is set

### Acceptance Criteria
- Clicking "Generate selection" populates links for all parts within 5-10 seconds
- "Available links" section shows fetched links with supplier, price, rating
- Errors are shown inline per-part (not silently swallowed)
- Server console shows successful Claude API calls
- If API key is missing, a clear error message appears

---

## 6. Persist Estimated Totals

### Problem

The estimated total (`$0.00` shown in the screenshot) is computed client-side from `grandTotal()` memo. It resets to `$0.00` on every page load because it depends on `selectedLinks` and `linksByPart` which start empty.

### Solution

Already addressed in **Section 3d** (local SQLite `estimated_totals` table). Additionally:

#### 6a. Show cached total immediately on mount

Before links finish loading, show the last-known estimated total from local-db:

```tsx
onMount(async () => {
  // ... existing state initialization ...

  // Show cached total while links load
  const cachedTotal = await getEstimatedTotal(currentBuildKey());
  if (cachedTotal) {
    setCachedGrandTotal(cachedTotal.totalCents / 100);
  }

  void findLinksForAllParts(false);
});

// Display: show cached total if live total is $0
const displayTotal = () => {
  const live = grandTotal();
  return live > 0 ? live : cachedGrandTotal();
};
```

#### 6b. Server-side persistence (optional enhancement)

Add an `estimated_totals` column to the server's `bom_selections` table or a new server table, so totals survive across devices:

**New migration:** `drizzle/0005_estimated_totals.sql`

```sql
CREATE TABLE estimated_totals (
  build_key        TEXT PRIMARY KEY,
  total_cents      INTEGER NOT NULL,
  hub_subtotal     INTEGER NOT NULL,
  sensor_subtotal  INTEGER NOT NULL,
  sensor_qty       INTEGER NOT NULL,
  computed_at      TEXT NOT NULL
);
```

**New Drizzle schema entry in `src/lib/schema.ts`:**

```typescript
export const estimatedTotals = sqliteTable('estimated_totals', {
  buildKey: text('build_key').primaryKey(),
  totalCents: integer('total_cents').notNull(),
  hubSubtotal: integer('hub_subtotal').notNull(),
  sensorSubtotal: integer('sensor_subtotal').notNull(),
  sensorQty: integer('sensor_qty').notNull(),
  computedAt: text('computed_at').notNull(),
});
```

**API endpoint:** `PUT /api/bom-selections` should also persist the estimated total alongside selections.

### Files Changed
- `src/lib/local-db.ts` — `estimated_totals` table (from Section 3)
- `src/components/BomWorkspace.tsx` — show cached total on mount, persist on change
- `drizzle/0005_estimated_totals.sql` — **new migration**
- `src/lib/schema.ts` — add `estimatedTotals` table
- `src/pages/api/bom-selections.ts` — accept and persist estimated total

### Acceptance Criteria
- Estimated total shows last-known value immediately on page load (not $0.00)
- Total updates in real-time as links resolve
- Total persists across page navigations and browser sessions
- Total syncs to server when selections are saved

---

## Implementation Order

```
Phase 1 — Fix what's broken (critical path)
  1. Fix link generation (Section 5) — nothing else matters if links don't work
  2. Fix navigation (Section 1) — quick wins, mostly already done

Phase 2 — UX improvements
  3. Unified button (Section 2) — small refactor, reduces confusion
  4. GIF loaders (Section 4) — visual polish, Spinner component

Phase 3 — Persistence layer
  5. Local SQLite (Section 3) — biggest feature, enables instant loads
  6. Estimated totals (Section 6) — depends on local SQLite + working links
```

## Testing Matrix

| Test | Verification |
|------|-------------|
| Link generation works | Click "Generate selection" → links appear for all parts within 10s |
| Links persist locally | Generate links → hard refresh → links still shown (from local-db) |
| Navigation is instant | Click nav links → page transition < 100ms perceived |
| Unified button works | Single "Generate selection" fetches + selects in one action |
| Loaders show | During any async operation, animated spinner is visible |
| Estimated total persists | Navigate away from BOM → return → total shows immediately |
| Error handling | Remove API key → clear error message per-part, no silent failures |
| Offline catalog | Disconnect network → catalog pages still render from local cache |
| Cache invalidation | "Refresh all links" clears local cache and re-fetches |
| Back/forward nav | Browser back button preserves BOM state correctly |

## Dependencies to Add

```bash
sfw bun add sql.js@1.12.0
```

No other new dependencies. The Spinner component is pure CSS + SVG.

## Notes

- The `CDSConvert` console errors (`Could not establish connection`) are from a browser extension, not our app
- The `--localstorage-file` warning in server logs is from Miniflare (Wrangler local dev), not actionable
- The `404` for `astro_runtime_client_dev-toolbar_entrypoint__js.js.map` is an Astro dev toolbar source map issue, harmless in dev
