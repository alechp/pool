import { createEffect, createMemo, createSignal, For, Show, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import type { BomLink, Part } from '../lib/data';
import HardwareThumbnail from './HardwareThumbnail';
import { getPartVisualVariant } from '../lib/hardwareVisuals';

type WorkspacePart = Part & {
  scope: 'hub' | 'sensor';
  quantity: number;
};

type SortKey = 'part' | 'supplier' | 'price' | 'confidence';
type FilterMode = 'best-price' | 'best-quality';
type InitialState = {
  filterMode?: FilterMode | null;
  selections?: SelectedLinkMap;
  selectionSource?: Record<string, SelectionSource>;
};

interface Props {
  buildKey: string;
  title: string;
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
  filterMode: FilterMode;
  selections: SelectedLinkMap;
  selectionSource: Record<string, SelectionSource>;
};

const STORAGE_KEY = 'poolguard-bom-workspace';

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

function chooseLink(links: BomLink[], mode: FilterMode) {
  const ordered = [...links].sort((a, b) => {
    if (mode === 'best-price') {
      const priceDiff = parsePrice(a.price) - parsePrice(b.price);
      if (priceDiff !== 0) return priceDiff;
      return confidenceRank(b.confidence) - confidenceRank(a.confidence);
    }

    const confidenceDiff = confidenceRank(b.confidence) - confidenceRank(a.confidence);
    if (confidenceDiff !== 0) return confidenceDiff;
    return parsePrice(a.price) - parsePrice(b.price);
  });
  return ordered[0] ?? null;
}

function loadWorkspaceState(buildKey: string): BomWorkspaceState {
  if (typeof localStorage === 'undefined') {
    return { filterMode: 'best-quality', selections: {}, selectionSource: {} };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${buildKey}`);
    if (!raw) return { filterMode: 'best-quality', selections: {}, selectionSource: {} };
    const parsed = JSON.parse(raw) as Partial<BomWorkspaceState>;
    return {
      filterMode: parsed.filterMode === 'best-price' ? 'best-price' : 'best-quality',
      selections: parsed.selections ?? {},
      selectionSource: parsed.selectionSource ?? {},
    };
  } catch {
    return { filterMode: 'best-quality', selections: {}, selectionSource: {} };
  }
}

function saveWorkspaceState(buildKey: string, state: BomWorkspaceState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_KEY}:${buildKey}`, JSON.stringify(state));
}

const BomWorkspace: Component<Props> = (props) => {
  const [filterMode, setFilterMode] = createSignal<FilterMode>('best-quality');
  const [selectedLinks, setSelectedLinks] = createSignal<SelectedLinkMap>({});
  const [selectionSource, setSelectionSource] = createSignal<Record<string, SelectionSource>>({});
  const [sortKey, setSortKey] = createSignal<SortKey>('part');
  const [descending, setDescending] = createSignal(false);
  const [linksByPart, setLinksByPart] = createSignal<Record<string, BomLink[]>>({});
  const [loadingParts, setLoadingParts] = createSignal<string[]>([]);
  const [saveState, setSaveState] = createSignal<'idle' | 'saved'>('idle');

  const parts = createMemo<WorkspacePart[]>(() => [
    ...props.hubParts.map((part) => ({ ...part, scope: 'hub' as const, quantity: 1 })),
    ...props.sensorParts.map((part) => ({ ...part, scope: 'sensor' as const, quantity: props.quantity })),
  ]);

  onMount(() => {
    if (props.initialState?.selections && Object.keys(props.initialState.selections).length > 0) {
      setFilterMode(props.initialState.filterMode === 'best-price' ? 'best-price' : 'best-quality');
      setSelectedLinks(props.initialState.selections);
      setSelectionSource(props.initialState.selectionSource ?? {});
      return;
    }

    const stored = loadWorkspaceState(props.buildKey);
    setFilterMode(stored.filterMode);
    setSelectedLinks(stored.selections);
    setSelectionSource(stored.selectionSource);
  });

  createEffect(() => {
    const mode = filterMode();
    const currentLinks = linksByPart();
    setSelectedLinks((current) => {
      const next = { ...current };
      const source = { ...selectionSource() };
      for (const part of parts()) {
        if (current[part.name]) continue;
        const chosen = chooseLink(currentLinks[part.name] ?? [], mode);
        if (chosen) {
          next[part.name] = chosen.url;
          if (!source[part.name]) source[part.name] = 'default';
        }
      }
      setSelectionSource(source);
      return next;
    });
  });

  async function ensureLinks(part: WorkspacePart, refresh = false) {
    if (loadingParts().includes(part.name)) return;
    setLoadingParts((current) => [...current, part.name]);

    try {
      const cached = await fetch(`/api/bom-links?partName=${encodeURIComponent(part.name)}`);
      const cachedData = await cached.json();
      if (!refresh && Array.isArray(cachedData.links) && cachedData.links.length > 0) {
        setLinksByPart((current) => ({ ...current, [part.name]: cachedData.links }));
        return;
      }

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
      if (Array.isArray(liveData.links)) {
        setLinksByPart((current) => ({ ...current, [part.name]: liveData.links }));
      }
    } finally {
      setLoadingParts((current) => current.filter((name) => name !== part.name));
    }
  }

  createEffect(() => {
    for (const part of parts()) {
      if (!linksByPart()[part.name] && !loadingParts().includes(part.name)) {
        ensureLinks(part);
      }
    }
  });

  function applyGlobalMode(mode: FilterMode) {
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
    saveWorkspaceState(props.buildKey, {
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
        buildKey: props.buildKey,
        filterMode: filterMode(),
        selections: payload,
      }),
    });

    setSaveState('saved');
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
        case 'confidence':
          result = confidenceRank(selectedA?.confidence ?? 'low') - confidenceRank(selectedB?.confidence ?? 'low');
          break;
        default:
          result = a.name.localeCompare(b.name);
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

  return (
    <div class="pb-16">
      <section class="mb-8 rounded-2xl border border-border bg-bg-surface p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">BOM workspace</div>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight">{props.title}</h2>
            <p class="mt-2 max-w-[48rem] text-sm text-text-secondary">
              Compare supplier options across the full bill of materials, apply a global price or quality strategy, then override any individual part and save the exact links you want this build to use.
            </p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-black/12 px-4 py-3 text-right">
            <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Estimated total</div>
            <div class="mt-1 text-2xl font-semibold text-accent">${grandTotal().toFixed(2)}</div>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => applyGlobalMode('best-quality')}
            class={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filterMode() === 'best-quality' ? 'bg-accent text-bg-deep' : 'bg-white/6 text-text-secondary hover:text-text-primary'
            }`}
          >
            Best quality
          </button>
          <button
            onClick={() => applyGlobalMode('best-price')}
            class={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filterMode() === 'best-price' ? 'bg-accent text-bg-deep' : 'bg-white/6 text-text-secondary hover:text-text-primary'
            }`}
          >
            Best price
          </button>
          <div class="rounded-full border border-white/8 px-4 py-2 text-sm text-text-tertiary">
            Sensor quantity: <span class="text-text-primary">{props.quantity}</span>
          </div>
          <button
            onClick={persistSelection}
            class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-deep transition-colors hover:bg-accent-dim"
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
            class="rounded-full bg-white/6 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/10"
          >
            Open all selected links
          </button>
          <Show when={saveState() === 'saved'}>
            <div class="rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent">
              Saved
            </div>
          </Show>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-bg-surface overflow-hidden">
        <div class="grid grid-cols-[1.2fr_0.85fr_0.85fr_0.65fr_0.55fr] gap-4 border-b border-white/6 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
          <button class="text-left" onClick={() => setSort('part')}>Part</button>
          <button class="text-left" onClick={() => setSort('supplier')}>Selected supplier</button>
          <button class="text-left" onClick={() => setSort('price')}>Price</button>
          <button class="text-left" onClick={() => setSort('confidence')}>Confidence</button>
          <div class="text-right">Open</div>
        </div>

        <For each={rows()}>
          {(part) => {
            const links = () => linksByPart()[part.name] ?? [];
            const selected = () => links().find((link) => link.url === selectedLinks()[part.name]) ?? chooseLink(links(), filterMode());
            return (
              <div class="border-b border-white/4 px-5 py-4 last:border-b-0">
                <div class="grid grid-cols-[1.2fr_0.85fr_0.85fr_0.65fr_0.55fr] gap-4 items-center">
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

                  <div class="text-sm text-text-primary">{selected()?.supplier ?? 'Loading…'}</div>
                  <div class="text-sm text-text-primary">
                    {selected()?.price ? `${selected()!.price}${part.quantity > 1 ? ` × ${part.quantity}` : ''}` : '—'}
                  </div>
                  <div>
                    <div class="text-sm text-text-secondary">{selected()?.confidence ?? '—'}</div>
                    <div class="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                      {selectionSource()[part.name] ?? 'default'}
                    </div>
                  </div>
                  <div class="text-right">
                    <Show when={selected()} fallback={<span class="text-xs text-text-tertiary">Waiting</span>}>
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
                    <button
                      onClick={() => ensureLinks(part, true)}
                      class="text-xs text-text-tertiary hover:text-text-primary"
                    >
                      Refresh live links
                    </button>
                  </div>
                  <Show when={links().length > 0} fallback={<div class="text-sm text-text-tertiary">Loading supplier options…</div>}>
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
                                  {link.price ?? 'Price unavailable'} · {link.confidence} confidence
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
      </section>
    </div>
  );
};

export default BomWorkspace;
