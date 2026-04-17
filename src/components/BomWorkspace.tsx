import { createEffect, createMemo, createSignal, For, Show, onMount, batch, untrack } from 'solid-js';
import type { Component } from 'solid-js';
import type { BomLink, Part } from '../lib/data';
import HardwareThumbnail from './HardwareThumbnail';
import Dropdown from './Dropdown';
import Spinner from './Spinner';
import { getPartVisualVariant } from '../lib/hardwareVisuals';
import { getCachedLinks, setCachedLinks, getEstimatedTotal, setEstimatedTotal } from '../lib/local-db';

type WorkspacePart = Part & {
  scope: 'hub' | 'sensor';
  quantity: number;
};

type SortKey = 'part' | 'supplier' | 'price' | 'rating';
type LinkStrategy = 'cheapest' | 'most-expensive' | 'highest-rating';
type InitialState = {
  filterMode?: string | null;
  selections?: SelectedLinkMap;
  selectionSource?: Record<string, SelectionSource>;
};

interface Props {
  buildKey: string;
  title: string;
  hubTypeId: string;
  hubTierId?: string | null;
  sensorTierId: string;
  hubName?: string | null;
  sensorName: string;
  quantity: number;
  hubParts: Part[];
  sensorParts: Part[];
  initialState?: InitialState;
}

type SelectedLinkMap = Record<string, string>;
type SelectionSource = 'default' | 'filter' | 'manual';
type BomWorkspaceState = {
  filterMode: LinkStrategy;
  selections: SelectedLinkMap;
  selectionSource: Record<string, SelectionSource>;
};

const STORAGE_KEY = 'poolguard-bom-workspace';
const SENSOR_QTY_OPTIONS = [1, 2, 4, 6, 8, 12, 16];

function parsePrice(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function confidenceRank(confidence: BomLink['confidence']): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function ratingRank(rating: number | null): number {
  return typeof rating === 'number' ? rating : -1;
}

function formatRating(rating: number | null) {
  return typeof rating === 'number' ? `${(rating / 10).toFixed(1)}★` : '—';
}

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

function normalizeStrategy(value: string | null | undefined): LinkStrategy {
  switch (value) {
    case 'best-price':
    case 'cheapest':
      return 'cheapest';
    case 'most-expensive':
      return 'most-expensive';
    case 'best-quality':
    case 'highest-rating':
    default:
      return 'highest-rating';
  }
}

function chooseLink(links: BomLink[], mode: LinkStrategy) {
  const ordered = [...links].sort((a, b) => {
    if (mode === 'cheapest') {
      const priceDiff = parsePrice(a.price) - parsePrice(b.price);
      if (priceDiff !== 0) return priceDiff;
      const ratingDiff = ratingRank(b.rating) - ratingRank(a.rating);
      if (ratingDiff !== 0) return ratingDiff;
      return confidenceRank(b.confidence) - confidenceRank(a.confidence);
    }

    if (mode === 'most-expensive') {
      const priceDiff = parsePrice(b.price) - parsePrice(a.price);
      if (priceDiff !== 0) return priceDiff;
      const ratingDiff = ratingRank(b.rating) - ratingRank(a.rating);
      if (ratingDiff !== 0) return ratingDiff;
      return confidenceRank(b.confidence) - confidenceRank(a.confidence);
    }

    const ratingDiff = ratingRank(b.rating) - ratingRank(a.rating);
    if (ratingDiff !== 0) return ratingDiff;
    const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence);
    if (confidenceDiff !== 0) return confidenceDiff;
    return parsePrice(a.price) - parsePrice(b.price);
  });

  return ordered[0] ?? null;
}

function loadWorkspaceState(buildKey: string): BomWorkspaceState {
  if (typeof localStorage === 'undefined') {
    return { filterMode: 'highest-rating', selections: {}, selectionSource: {} };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${buildKey}`);
    if (!raw) return { filterMode: 'highest-rating', selections: {}, selectionSource: {} };
    const parsed = JSON.parse(raw) as Partial<BomWorkspaceState>;
    return {
      filterMode: normalizeStrategy(parsed.filterMode),
      selections: parsed.selections ?? {},
      selectionSource: parsed.selectionSource ?? {},
    };
  } catch {
    return { filterMode: 'highest-rating', selections: {}, selectionSource: {} };
  }
}

function saveWorkspaceState(buildKey: string, state: BomWorkspaceState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_KEY}:${buildKey}`, JSON.stringify(state));
}

const linkCache = new Map<string, { links: BomLink[]; fetchedAt: number }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000;

const LinksEmptyState: Component<{ error?: string; loading?: boolean }> = (props) => (
  <div>
    {props.error && (
      <div class="mb-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
        {props.error}
      </div>
    )}
    <div class="text-sm text-text-tertiary">
      {props.loading
        ? 'Fetching links...'
        : 'No supplier links yet. Click "Generate selection" or refresh this part.'}
    </div>
  </div>
);

const BomWorkspace: Component<Props> = (props) => {
  const [filterMode, setFilterMode] = createSignal<LinkStrategy>('highest-rating');
  const [selectedLinks, setSelectedLinks] = createSignal<SelectedLinkMap>({});
  const [selectionSource, setSelectionSource] = createSignal<Record<string, SelectionSource>>({});
  const [sortKey, setSortKey] = createSignal<SortKey>('part');
  const [descending, setDescending] = createSignal(false);
  const [linksByPart, setLinksByPart] = createSignal<Record<string, BomLink[]>>({});
  const [loadingParts, setLoadingParts] = createSignal<string[]>([]);
  const [saveState, setSaveState] = createSignal<'idle' | 'saved'>('idle');
  const [bulkState, setBulkState] = createSignal<'idle' | 'loading' | 'loaded'>('idle');
  const [linkErrors, setLinkErrors] = createSignal<Record<string, string>>({});
  const [cachedGrandTotal, setCachedGrandTotal] = createSignal(0);
  const [qty, setQty] = createSignal(props.quantity);
  const currentBuildKey = createMemo(() => {
    const params = new URLSearchParams();
    params.set('hub_type', props.hubTypeId);
    if (props.hubTierId) params.set('hub_tier', props.hubTierId);
    params.set('sensor_tier', props.sensorTierId);
    params.set('qty', String(qty()));
    return params.toString();
  });

  const parts = createMemo<WorkspacePart[]>(() => [
    ...props.hubParts.map((part) => ({ ...part, scope: 'hub' as const, quantity: 1 })),
    ...props.sensorParts.map((part) => ({ ...part, scope: 'sensor' as const, quantity: qty() })),
  ]);

  onMount(async () => {
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

    // Show cached total while links load
    const cachedTotal = await getEstimatedTotal(currentBuildKey());
    if (cachedTotal) setCachedGrandTotal(cachedTotal.totalCents / 100);

    void findLinksForAllParts(false);
  });

  createEffect(() => {
    const mode = filterMode();
    const currentLinks = linksByPart();
    const currentParts = parts();
    const currentSelected = selectedLinks();
    const currentSource = selectionSource();

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
      batch(() => {
        untrack(() => {
          setSelectedLinks(nextSelected);
          setSelectionSource(nextSource);
        });
      });
    }
  });

  async function ensureLinks(part: WorkspacePart, refresh = false) {
    if (loadingParts().includes(part.name)) return;

    // Check in-memory cache first, then local SQLite cache
    if (!refresh) {
      const memCached = linkCache.get(part.name);
      if (memCached && Date.now() - memCached.fetchedAt < CLIENT_CACHE_TTL) {
        setLinksByPart((current) => ({ ...current, [part.name]: memCached.links }));
        return;
      }

      const localLinks = await getCachedLinks(part.name);
      if (localLinks.length > 0) {
        const age = Date.now() - new Date(localLinks[0].fetchedAt).getTime();
        if (age < CLIENT_CACHE_TTL) {
          const mapped = localLinks as unknown as BomLink[];
          setLinksByPart((current) => ({ ...current, [part.name]: mapped }));
          linkCache.set(part.name, { links: mapped, fetchedAt: Date.now() });
          return;
        }
      }
    }

    setLoadingParts((current) => [...current, part.name]);
    setLinkErrors((current) => {
      const next = { ...current };
      delete next[part.name];
      return next;
    });

    try {
      // Phase 1: Try server cache (GET)
      const cached = await fetch(`/api/bom-links?partName=${encodeURIComponent(part.name)}`);
      const cachedData = await cached.json();

      if (!refresh && Array.isArray(cachedData.links) && cachedData.links.length > 0) {
        setLinksByPart((current) => ({ ...current, [part.name]: cachedData.links }));
        linkCache.set(part.name, { links: cachedData.links, fetchedAt: Date.now() });
        void setCachedLinks(part.name, cachedData.links);
        return;
      }

      // Phase 2: Generate via Claude API (POST)
      const live = await fetch('/api/bom-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName: part.name,
          partDescription: part.description,
          targetPrice: part.price,
          refresh,
        }),
      });
      const liveData = await live.json();

      if (liveData.error) {
        console.warn(`[BOM] Link generation failed for "${part.name}":`, liveData.error);
        setLinkErrors((current) => ({ ...current, [part.name]: liveData.error }));
        return;
      }

      if (Array.isArray(liveData.links) && liveData.links.length > 0) {
        setLinksByPart((current) => ({ ...current, [part.name]: liveData.links }));
        linkCache.set(part.name, { links: liveData.links, fetchedAt: Date.now() });
        void setCachedLinks(part.name, liveData.links);
      } else {
        setLinkErrors((current) => ({ ...current, [part.name]: 'No links found for this part' }));
      }
    } catch (err) {
      console.error(`[BOM] Network error fetching links for "${part.name}":`, err);
      setLinkErrors((current) => ({ ...current, [part.name]: 'Network error — check connection' }));
    } finally {
      setLoadingParts((current) => current.filter((name) => name !== part.name));
    }
  }

  async function findLinksForAllParts(refresh = false) {
    setBulkState('loading');
    await Promise.all(parts().map((part) => ensureLinks(part, refresh)));
    setBulkState('loaded');
  }

  async function generateSelectionBy(mode: LinkStrategy, forceRefresh = false) {
    await findLinksForAllParts(forceRefresh);
    setFilterMode(mode);
    setSaveState('idle');
    setSelectedLinks((current) => {
      const next = { ...current };
      const source = { ...selectionSource() };

      for (const part of parts()) {
        const chosen = chooseLink(linksByPart()[part.name] ?? [], mode);
        if (chosen) {
          next[part.name] = chosen.url;
          source[part.name] = 'filter';
        }
      }

      setSelectionSource(source);
      return next;
    });
  }

  function setSort(nextKey: SortKey) {
    if (sortKey() === nextKey) {
      setDescending(!descending());
      return;
    }
    setSortKey(nextKey);
    setDescending(false);
  }

  async function persistSelection() {
    saveWorkspaceState(currentBuildKey(), {
      filterMode: filterMode(),
      selections: selectedLinks(),
      selectionSource: selectionSource(),
    });

    const payload = parts()
      .map((part) => {
        const selected = (linksByPart()[part.name] ?? []).find((link) => link.url === selectedLinks()[part.name]) ?? null;
        return {
          partName: part.name,
          selectedUrl: selectedLinks()[part.name],
          selectedSupplier: selected?.supplier ?? null,
          selectionSource: selectionSource()[part.name] ?? 'default',
        };
      })
      .filter((row) => row.selectedUrl);

    await fetch('/api/bom-selections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildKey: currentBuildKey(),
        filterMode: filterMode(),
        selections: payload,
      }),
    });

    setSaveState('saved');
  }

  function handleQtyChange(nextQty: number) {
    setQty(nextQty);
    const params = new URLSearchParams();
    params.set('hub_type', props.hubTypeId);
    if (props.hubTierId) params.set('hub_tier', props.hubTierId);
    params.set('sensor_tier', props.sensorTierId);
    params.set('qty', String(nextQty));
    history.replaceState(null, '', `/bom?${params.toString()}`);
  }

  const rows = createMemo(() => {
    const sorted = [...parts()].sort((a, b) => {
      const selectedA = (linksByPart()[a.name] ?? []).find((link) => link.url === selectedLinks()[a.name]) ?? null;
      const selectedB = (linksByPart()[b.name] ?? []).find((link) => link.url === selectedLinks()[b.name]) ?? null;

      let result = 0;
      switch (sortKey()) {
        case 'supplier':
          result = (selectedA?.supplier ?? '').localeCompare(selectedB?.supplier ?? '');
          break;
        case 'price':
          result = parsePrice(selectedA?.price ?? null) - parsePrice(selectedB?.price ?? null);
          break;
        case 'rating':
          result = ratingRank(selectedA?.rating ?? null) - ratingRank(selectedB?.rating ?? null);
          break;
        default:
          result = a.name.localeCompare(b.name);
          break;
      }

      return descending() ? result * -1 : result;
    });

    return sorted;
  });

  const grandTotal = createMemo(() => {
    return rows().reduce((sum, part) => {
      const selected = (linksByPart()[part.name] ?? []).find((link) => link.url === selectedLinks()[part.name]) ?? null;
      const price = parsePrice(selected?.price ?? null);
      return sum + (Number.isFinite(price) ? price * part.quantity : 0);
    }, 0);
  });

  // Display cached total while live total is computing
  const displayTotal = () => {
    const live = grandTotal();
    return live > 0 ? live : cachedGrandTotal();
  };

  // Persist estimated total to local SQLite whenever it changes
  createEffect(() => {
    const total = grandTotal();
    if (total > 0) {
      const hubTotal = rows()
        .filter((p) => p.scope === 'hub')
        .reduce((sum, p) => {
          const sel = (linksByPart()[p.name] ?? []).find((l) => l.url === selectedLinks()[p.name]) ?? null;
          const price = parsePrice(sel?.price ?? null);
          return sum + (Number.isFinite(price) ? price * p.quantity : 0);
        }, 0);
      void setEstimatedTotal(currentBuildKey(), {
        totalCents: Math.round(total * 100),
        hubSubtotal: Math.round(hubTotal * 100),
        sensorSubtotal: Math.round((total - hubTotal) * 100),
        sensorQty: qty(),
      });
    }
  });

  return (
    <div class="pb-16">
      <section class="mb-8 rounded-2xl border border-border bg-bg-surface p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">BOM workspace</div>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight">{props.title}</h2>
            <p class="mt-2 max-w-[52rem] text-sm text-text-secondary">
              Find supplier links across the full bill of materials, generate a default selection by price or rating, then override any individual part and save the exact shopping set you want.
            </p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-black/12 px-4 py-3 text-right">
            <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Estimated total</div>
            <div class="mt-1 text-2xl font-semibold text-accent">${displayTotal().toFixed(2)}</div>
          </div>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-[1.2fr_1fr_auto]">
          <label class="rounded-2xl border border-white/8 bg-black/12 p-4">
            <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Generate links by</div>
            <Dropdown
              options={[
                { value: 'cheapest', label: 'Cheapest' },
                { value: 'most-expensive', label: 'Most Expensive' },
                { value: 'highest-rating', label: 'Highest Rating' },
              ]}
              value={filterMode()}
              onChange={(v) => setFilterMode((v as LinkStrategy) ?? 'highest-rating')}
              placeholder="Select strategy"
              class="mt-3"
            />
          </label>

          <label class="rounded-2xl border border-white/8 bg-black/12 p-4">
            <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Sensor quantity</div>
            <Dropdown
              options={SENSOR_QTY_OPTIONS.map((q) => ({ value: String(q), label: `${q} sensors` }))}
              value={String(qty())}
              onChange={(v) => handleQtyChange(Number(v ?? props.quantity))}
              placeholder="Select quantity"
              class="mt-3"
            />
          </label>

          <div class="flex flex-col gap-3 w-full md:w-auto">
            <button
              onClick={() => void generateSelectionBy(filterMode())}
              disabled={bulkState() === 'loading'}
              class="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim disabled:opacity-60 w-full md:w-auto"
            >
              {bulkState() === 'loading' ? <Spinner size="sm" label="Generating..." /> : 'Generate selection'}
            </button>
            <button
              onClick={() => void generateSelectionBy(filterMode(), true)}
              disabled={bulkState() === 'loading'}
              class="text-xs text-text-tertiary hover:text-text-primary underline disabled:opacity-60"
            >
              Refresh all links from scratch
            </button>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            onClick={persistSelection}
            class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim w-full sm:w-auto"
          >
            Save BOM selection
          </button>
          <button
            onClick={() => {
              for (const part of rows()) {
                const selected = (linksByPart()[part.name] ?? []).find((link) => link.url === selectedLinks()[part.name]) ?? null;
                if (selected?.url) {
                  window.open(selected.url, '_blank', 'noopener,noreferrer');
                }
              }
            }}
            class="rounded-full bg-white/6 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/10 w-full sm:w-auto"
          >
            Open all selected shopping links
          </button>
          <Show when={bulkState() === 'loaded'}>
            <div class="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-text-secondary">
              Link set loaded
            </div>
          </Show>
          <Show when={saveState() === 'saved'}>
            <div class="rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent">
              Saved
            </div>
          </Show>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-bg-surface overflow-hidden">
        <div class="overflow-x-auto">
        <div class="grid grid-cols-[1.15fr_0.8fr_0.65fr_0.55fr_0.55fr_0.45fr] gap-4 border-b border-white/6 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary min-w-[700px]">
          <button class="text-left" onClick={() => setSort('part')}>Part</button>
          <button class="text-left" onClick={() => setSort('supplier')}>Supplier</button>
          <button class="text-left" onClick={() => setSort('price')}>Price</button>
          <button class="text-left" onClick={() => setSort('rating')}>Rating</button>
          <div class="text-left">Source</div>
          <div class="text-right">Open</div>
        </div>

        <For each={rows()}>
          {(part) => {
            const links = () => linksByPart()[part.name] ?? [];
            const selected = () => links().find((link) => link.url === selectedLinks()[part.name]) ?? chooseLink(links(), filterMode());

            return (
              <div class="border-b border-white/4 px-5 py-4 last:border-b-0 min-w-[700px]">
                <div class="grid grid-cols-[1.15fr_0.8fr_0.65fr_0.55fr_0.55fr_0.45fr] gap-4 items-center">
                  <div class="flex items-center gap-3 min-w-0">
                    <HardwareThumbnail variant={getPartVisualVariant(part.name)} title={part.name} class="h-14 w-20 flex-none" />
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-text-primary">{part.name}</div>
                      <div class="mt-1 text-xs text-text-tertiary">{part.description}</div>
                      <div class="mt-1 text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                        {part.scope === 'hub' ? props.hubName || 'Hub' : props.sensorName} · qty {part.quantity}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div class="text-sm text-text-primary">{selected()?.supplier ?? 'No link yet'}</div>
                    <div class="mt-1 text-xs text-text-tertiary">{selected()?.confidence ?? 'Not ranked'}</div>
                  </div>

                  <div class="text-sm text-text-primary">
                    {selected()?.price ? `${selected()!.price}${part.quantity > 1 ? ` × ${part.quantity}` : ''}` : '—'}
                  </div>

                  <div class="text-sm text-text-primary">{formatRating(selected()?.rating ?? null)}</div>

                  <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                    {selectionSource()[part.name] ?? 'default'}
                  </div>

                  <div class="text-right">
                    <Show when={selected()} fallback={
                      loadingParts().includes(part.name)
                        ? (<Spinner size="sm" />)
                        : (<span class="text-xs text-text-tertiary">Waiting</span>)
                    }>
                      {(link) => (
                        <a href={link().url} target="_blank" rel="noreferrer" class="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20">
                          Open
                        </a>
                      )}
                    </Show>
                  </div>
                </div>

                <div class="mt-4 rounded-2xl border border-white/6 bg-black/12 p-4">
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Available links</div>
                    <div class="flex items-center gap-3">
                      <Show when={(linksByPart()[part.name] ?? [])[0]?.fetchedAt}>
                        {(fetchedAt) => (
                          <span class="text-[10px] text-text-tertiary font-mono">
                            Updated {formatRelativeTime(fetchedAt())}
                          </span>
                        )}
                      </Show>
                      {loadingParts().includes(part.name)
                        ? (<Spinner size="sm" label="Loading..." />)
                        : (
                          <button
                            onClick={() => void ensureLinks(part, true)}
                            class="text-xs text-text-tertiary hover:text-text-primary"
                          >
                            Refresh this part
                          </button>
                        )
                      }
                    </div>
                  </div>

                  <Show when={links().length > 0} fallback={
                    <LinksEmptyState error={linkErrors()[part.name]} loading={loadingParts().includes(part.name)} />
                  }>
                    <div class="space-y-2">
                      <For each={links()}>
                        {(link) => (
                          <label class={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-3 py-3 transition-colors ${
                            selectedLinks()[part.name] === link.url
                              ? 'border-accent/35 bg-accent/8'
                              : 'border-white/6 bg-white/3'
                          }`}>
                            <div class="flex items-center gap-3 min-w-0">
                              <input
                                type="radio"
                                name={`bom-${part.name}`}
                                checked={selectedLinks()[part.name] === link.url}
                                onChange={() => {
                                  setSelectedLinks((current) => ({ ...current, [part.name]: link.url }));
                                  setSelectionSource((current) => ({ ...current, [part.name]: 'manual' }));
                                  setSaveState('idle');
                                }}
                              />
                              <div class="min-w-0">
                                <div class="text-sm font-medium text-text-primary">{link.supplier}</div>
                                <div class="mt-1 text-xs text-text-tertiary">
                                  {link.price ?? 'Price unavailable'} · {formatRating(link.rating ?? null)} · {link.confidence} confidence
                                </div>
                              </div>
                            </div>
                            <a href={link.url} target="_blank" rel="noreferrer" class="text-xs text-accent hover:underline">
                              Open →
                            </a>
                          </label>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
        </div>
      </section>
    </div>
  );
};

export default BomWorkspace;
