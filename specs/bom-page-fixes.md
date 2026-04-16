# BOM Page Fixes Spec

## Overview

The BOM Workspace page (`/bom`) has four critical issues: an infinite-loop crash, missing link caching UX, unstyled dropdowns, and slow page loads. This spec addresses all four.

---

## Issue 1: Infinite Loop Crash (Maximum call stack size exceeded)

### Root Cause

`BomWorkspace.tsx:176-195` — the `createEffect` calls `setSelectionSource()` inside its reactive scope. In SolidJS, calling a setter inside an effect that transitively tracks that signal creates an infinite re-execution cycle:

```
createEffect runs
  → reads filterMode(), linksByPart(), parts()
  → calls setSelectedLinks(fn) which calls setSelectionSource()
  → selectionSource signal updates
  → SolidJS schedules downstream effects
  → createEffect runs again → infinite loop → stack overflow
```

The second `RangeError` at line 179 confirms: `setSelectedLinks` is being re-entered recursively.

### Fix

Restructure the effect to avoid writing to `selectionSource` inside the `setSelectedLinks` updater. Use `batch()` from SolidJS and guard against re-entry:

```tsx
// BEFORE (broken — lines 176-195)
createEffect(() => {
  const mode = filterMode();
  const currentLinks = linksByPart();
  setSelectedLinks((current) => {
    const next = { ...current };
    const source = { ...selectionSource() };  // ← reads selectionSource inside setSelectedLinks
    for (const part of parts()) {
      if (current[part.name]) continue;
      const chosen = chooseLink(currentLinks[part.name] ?? [], mode);
      if (chosen) {
        next[part.name] = chosen.url;
        if (!source[part.name]) source[part.name] = 'default';
      }
    }
    setSelectionSource(source);  // ← triggers re-render inside setter = infinite loop
    return next;
  });
});

// AFTER (fixed)
createEffect(() => {
  const mode = filterMode();
  const currentLinks = linksByPart();
  const currentParts = parts();
  const currentSelected = selectedLinks();
  const currentSource = selectionSource();

  // Compute new values without triggering setters
  const nextSelected = { ...currentSelected };
  const nextSource = { ...currentSource };
  let changed = false;

  for (const part of currentParts) {
    if (currentSelected[part.name]) continue;
    const chosen = chooseLink(currentLinks[part.name] ?? [], mode);
    if (chosen) {
      nextSelected[part.name] = chosen.url;
      if (!nextSource[part.name]) nextSource[part.name] = 'default';
      changed = true;
    }
  }

  if (changed) {
    // Use untrack + batch to prevent re-triggering this effect
    import { untrack, batch } from 'solid-js';
    batch(() => {
      untrack(() => {
        setSelectedLinks(nextSelected);
        setSelectionSource(nextSource);
      });
    });
  }
});
```

### Key points:
- Read all reactive values at the top of the effect (so SolidJS tracks them)
- Compute the diff as plain objects
- Only write if something actually changed (prevents unnecessary renders)
- Wrap setters in `untrack` + `batch` to prevent the effect from re-triggering itself

### Files changed
- `src/components/BomWorkspace.tsx` — lines 176-195

---

## Issue 2: Link/Price Caching with Refresh & Last-Updated Timestamps

### Current State

- Links are cached server-side in D1 (`bomLinks` table) with a `fetchedAt` column and 7-day TTL
- Frontend has no visibility into cache freshness — no "last updated" display
- On mount, `findLinksForAllParts(false)` fires a GET for every part, then a POST (Claude API call) for any uncached part — all in parallel, blocking render

### Changes

#### 2a. Display `fetchedAt` per component

Add a `fetchedAt` field to the client-side link data structure and display it in the "Available links" section of each part row.

**API change:** The GET endpoint already returns the full `bomLinks` rows which include `fetchedAt`. No API change needed.

**Frontend change in `BomWorkspace.tsx`:**

Add a derived signal per part that extracts the most recent `fetchedAt` from that part's links:

```tsx
// Inside the <For each={rows()}> render, after the "Available links" header:
const lastFetched = () => {
  const partLinks = linksByPart()[part.name] ?? [];
  if (partLinks.length === 0) return null;
  // All links for a part share the same fetchedAt (fetched in one batch)
  return partLinks[0]?.fetchedAt ?? null;
};

// Render next to "Refresh this part" button:
<Show when={lastFetched()}>
  <span class="text-[10px] text-text-tertiary font-mono">
    Updated {formatRelativeTime(lastFetched()!)}
  </span>
</Show>
```

Add a `formatRelativeTime` helper:

```tsx
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

#### 2b. Client-side in-memory cache

Add an in-memory cache so navigating away and back doesn't re-fetch everything. Use a module-level `Map` outside the component:

```tsx
// Module-level cache (survives component remounts within the same SPA session)
const linkCache = new Map<string, { links: BomLink[]; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes client-side

async function ensureLinks(part: WorkspacePart, refresh = false) {
  // Check client-side cache first
  if (!refresh) {
    const cached = linkCache.get(part.name);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setLinksByPart((current) => ({ ...current, [part.name]: cached.links }));
      return;
    }
  }

  // ... existing fetch logic ...

  // After successful fetch, populate cache:
  linkCache.set(part.name, { links: fetchedLinks, fetchedAt: Date.now() });
}
```

#### 2c. Stale-while-revalidate pattern

On mount, immediately render from D1 cache (GET response), then optionally refresh stale entries in the background:

```tsx
onMount(() => {
  // ... existing state initialization ...

  // Phase 1: Load cached links (fast — just D1 reads, no AI calls)
  void loadCachedLinks();
});

async function loadCachedLinks() {
  setBulkState('loading');
  await Promise.all(
    parts().map(async (part) => {
      const resp = await fetch(`/api/bom-links?partName=${encodeURIComponent(part.name)}`);
      const data = await resp.json();
      if (Array.isArray(data.links) && data.links.length > 0) {
        setLinksByPart((current) => ({ ...current, [part.name]: data.links }));
        linkCache.set(part.name, { links: data.links, fetchedAt: Date.now() });
      }
    })
  );
  setBulkState('loaded');
}
```

The "Refresh this part" button and "Find links for all parts" button remain as explicit user actions that call the POST endpoint (which triggers Claude API).

### Files changed
- `src/components/BomWorkspace.tsx` — add cache layer, `fetchedAt` display, `formatRelativeTime` helper
- `src/pages/api/bom-links.ts` — no changes needed (already returns `fetchedAt`)

---

## Issue 3: Dropdown Styling

### Current State

The "Generate Links By" and "Sensor Quantity" selectors use native `<select>` elements (BomWorkspace.tsx lines 361-382). Native selects render with browser-default dropdown menus (white background, system font) that clash with the dark theme.

Meanwhile, a custom `Dropdown.tsx` component already exists that matches the design system (dark background, accent colors, keyboard navigation, proper animations).

### Fix

Replace the two native `<select>` elements in `BomWorkspace.tsx` with the existing `Dropdown` component.

```tsx
// BEFORE:
<select
  value={filterMode()}
  onChange={(e) => setFilterMode(e.currentTarget.value as LinkStrategy)}
  class="mt-3 w-full rounded-xl border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-primary outline-none"
>
  <option value="cheapest">Cheapest</option>
  <option value="most-expensive">Most Expensive</option>
  <option value="highest-rating">Highest Rating</option>
</select>

// AFTER:
import Dropdown from './Dropdown';

<Dropdown
  options={[
    { value: 'cheapest', label: 'Cheapest' },
    { value: 'most-expensive', label: 'Most Expensive' },
    { value: 'highest-rating', label: 'Highest Rating' },
  ]}
  value={filterMode()}
  onChange={(v) => setFilterMode((v as LinkStrategy) ?? 'highest-rating')}
  placeholder="Select strategy"
  class="mt-3 w-full"
/>
```

Same pattern for the sensor quantity select:

```tsx
<Dropdown
  options={SENSOR_QTY_OPTIONS.map((q) => ({ value: String(q), label: `${q} sensors` }))}
  value={String(qty())}
  onChange={(v) => handleQtyChange(Number(v ?? props.quantity))}
  placeholder="Select quantity"
  class="mt-3 w-full"
/>
```

### Minor Dropdown.tsx adjustments needed

The existing `Dropdown.tsx` button styling uses `bg-bg-elevated border-border` which is slightly different from the BOM card context (`bg-bg-card border-white/10`). Update the trigger button to match:

```tsx
// In Dropdown.tsx, update the trigger button class:
class="w-full rounded-xl border border-white/10 bg-bg-card px-4 py-3 text-sm text-text-primary
       cursor-pointer flex items-center justify-between gap-2 hover:border-border-hover
       transition-colors outline-none focus:border-border-active"
```

And ensure the dropdown menu has matching dark styling:

```tsx
// Menu container:
class="absolute z-50 mt-1 w-full bg-bg-card border border-white/10 rounded-xl
       shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 animate-[dropdown-in_0.15s_ease]"
```

### Files changed
- `src/components/BomWorkspace.tsx` — replace 2 `<select>` elements with `<Dropdown>` imports
- `src/components/Dropdown.tsx` — minor class adjustments for consistency with BOM card context

---

## Issue 4: Page Load Performance

### Current State

Page navigation to `/bom?...` is multi-second because:

1. **Server-side:** `bom.astro` runs 6 D1 queries synchronously (hubTypes, hubTiers, sensorTiers, hubParts, sensorParts, savedConfigs, bomSelections)
2. **Client-side hydration:** `onMount` immediately calls `findLinksForAllParts(false)` which fires N parallel requests (one GET + potentially one POST per part)
3. **Infinite loop (Issue 1):** The `createEffect` crash makes the page unresponsive even after hydration
4. **No client-side caching:** Every page navigation re-fetches everything

### Fixes

#### 4a. Fix the infinite loop (Issue 1)

This is the single biggest performance win. The crash prevents the page from ever becoming interactive. Fix described above.

#### 4b. Don't block render on link fetching

Currently `onMount` calls `findLinksForAllParts` which sets `bulkState('loading')` and awaits all fetches. The page should render immediately with "Waiting" placeholders and progressively fill in links.

```tsx
onMount(() => {
  // Restore persisted state synchronously (localStorage)
  if (props.initialState?.selections && Object.keys(props.initialState.selections).length > 0) {
    setFilterMode(normalizeStrategy(props.initialState.filterMode));
    setSelectedLinks(props.initialState.selections);
    setSelectionSource(props.initialState.selectionSource ?? {});
  } else {
    const stored = loadWorkspaceState(currentBuildKey());
    setFilterMode(stored.filterMode);
    setSelectedLinks(stored.selections);
    setSelectionSource(stored.selectionSource);
  }

  // Load cached links in background — don't block render
  void loadCachedLinks();
});
```

#### 4c. Server-side query optimization

Parallelize the D1 queries in `bom.astro`:

```astro
// BEFORE (sequential):
const raw = {
  hubTypes: await db.select().from(hubTypes).all(),
  hubTiers: await db.select().from(hubTiers).all(),
  ...
};

// AFTER (parallel):
const [hubTypesData, hubTiersData, sensorTiersData, hubPartsData, sensorPartsData] =
  await Promise.all([
    db.select().from(hubTypes).all(),
    db.select().from(hubTiers).all(),
    db.select().from(sensorTiers).all(),
    db.select().from(hubTierParts).all(),
    db.select().from(sensorTierParts).all(),
  ]);

const raw = {
  hubTypes: hubTypesData,
  hubTiers: hubTiersData,
  sensorTiers: sensorTiersData,
  hubParts: hubPartsData,
  sensorParts: sensorPartsData,
};
```

Also parallelize the `savedConfigs` and `bomSelections` queries (which depend on `sensorTier`):

```astro
const [savedConfigsData, persistedSelectionsData] = await Promise.all([
  db.select().from(savedConfigs).all(),
  sensorTier
    ? db.select().from(bomSelections).where(eq(bomSelections.buildKey, buildKey)).all()
    : Promise.resolve([]),
]);
```

#### 4d. Progressive loading UX

Instead of showing a blank/broken page while links load, show the BOM table immediately with skeleton states:

- Part names, descriptions, quantities — render immediately (from server props)
- Supplier, price, rating columns — show "Loading..." shimmer until links arrive
- "Available links" section — show "Fetching cached links..." placeholder

This requires no structural changes — just ensuring `bulkState` doesn't gate the entire table render (it currently doesn't, but the infinite loop prevents any render from completing).

### Files changed
- `src/components/BomWorkspace.tsx` — non-blocking mount, client cache
- `src/pages/bom.astro` — parallel D1 queries

---

## Implementation Order

1. **Issue 1 (infinite loop)** — Must fix first. Everything else is meaningless while the page crashes.
2. **Issue 4b (non-blocking mount)** — Quick win once the loop is fixed.
3. **Issue 4c (parallel queries)** — Quick win, independent of frontend changes.
4. **Issue 2 (caching UX)** — Adds the client-side cache layer and `fetchedAt` display.
5. **Issue 3 (dropdowns)** — Cosmetic, can be done in parallel with anything.

## Testing

- Verify no `RangeError: Maximum call stack size exceeded` in console after fix
- Verify BOM page renders within 1s of navigation (excluding AI-generated link fetches)
- Verify "Updated Xm ago" appears next to each part's "Refresh this part" button
- Verify "Refresh this part" clears cache and re-fetches from Claude API
- Verify dropdown menus match the dark theme (no white/light backgrounds)
- Verify keyboard navigation works on new dropdowns (arrow keys, enter, escape)
- Verify page still works when D1 has no cached links (fresh state)

## Notes

- The `chrome-extension://pgmaabkdpgbajndodihinkhgbjpoenmp` errors in the console are from the CDSConvert browser extension, not the app. These can be ignored.
- The `net::ERR_FILE_NOT_FOUND` for the extension asset is also the extension's issue, not ours.
