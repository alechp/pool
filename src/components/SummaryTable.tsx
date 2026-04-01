import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type FilterFn,
} from '@tanstack/solid-table';
import type { Catalog, SavedConfig, BuildCombo, Part } from '../lib/data';
import { buildCombos } from '../lib/data';
import Dropdown from './Dropdown';

const badgeStyles: Record<string, string> = {
  'badge-budget': 'bg-accent/12 text-accent',
  'badge-premium': 'bg-accent-blue/12 text-accent-blue',
  'badge-none': 'bg-white/6 text-text-secondary',
  'badge-zigbee': 'bg-accent-purple/12 text-accent-purple',
  'badge-lora': 'bg-accent-amber/12 text-accent-amber',
};

const borderColors: Record<string, string> = {
  none: 'border-l-text-secondary',
  zigbee: 'border-l-accent-purple',
  lorawan: 'border-l-accent-amber',
};

const VISIBILITY_STORAGE_KEY = 'poolguard-col-visibility';

function loadVisibility(): VisibilityState {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  return {};
}

function saveVisibility(state: VisibilityState) {
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function trackPreselection(hubTypeId: string, hubTierId: string | null, sensorTierId: string) {
  fetch('/api/preselections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hubTypeId,
      hubTierId,
      sensorTierId,
      source: 'pricing-table',
    }),
  }).catch(() => {
    // fire-and-forget — don't block navigation
  });
}

const globalFilterFn: FilterFn<BuildCombo> = (row, _columnId, filterValue) => {
  const search = String(filterValue).toLowerCase();
  if (!search) return true;

  const combo = row.original;
  const searchableValues = [
    combo.hubType.name,
    combo.hubType.badge,
    combo.hubTier?.name || '',
    combo.hubTier?.badge || '',
    combo.sensorTier.name,
    combo.sensorTier.badge,
    combo.battery,
    combo.commRange,
    String(combo.hubCost),
    String(combo.sensorCost),
    String(combo.totalAtFour),
    String(combo.partCount),
  ];

  return searchableValues.some((val) => val.toLowerCase().includes(search));
};

interface Props {
  catalog: Catalog;
  savedConfigs: SavedConfig[];
}

const SummaryTable: Component<Props> = (props) => {
  const [archFilter, setArchFilter] = createSignal<string | null>(null);
  const [tierFilter, setTierFilter] = createSignal<string | null>(null);
  const [expandedRow, setExpandedRow] = createSignal<number | null>(null);
  const [sorting, setSorting] = createSignal<SortingState>([{ id: 'totalAtFour', desc: false }]);
  const [configs, setConfigs] = createSignal(props.savedConfigs);
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(loadVisibility());
  const [globalFilter, setGlobalFilter] = createSignal('');
  const [searchInput, setSearchInput] = createSignal('');
  const [columnsPopoverOpen, setColumnsPopoverOpen] = createSignal(false);

  let columnsButtonRef: HTMLButtonElement | undefined;
  let columnsPopoverRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Debounce search input by 200ms
  createEffect(() => {
    const value = searchInput();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setGlobalFilter(value);
    }, 200);
  });

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Persist column visibility changes to localStorage
  createEffect(() => {
    const vis = columnVisibility();
    saveVisibility(vis);
  });

  // Click-outside handler for columns popover
  function handleColumnsClickOutside(e: MouseEvent) {
    if (
      columnsButtonRef &&
      !columnsButtonRef.contains(e.target as Node) &&
      columnsPopoverRef &&
      !columnsPopoverRef.contains(e.target as Node)
    ) {
      setColumnsPopoverOpen(false);
    }
  }

  document.addEventListener('mousedown', handleColumnsClickOutside);
  onCleanup(() => {
    document.removeEventListener('mousedown', handleColumnsClickOutside);
  });

  const allCombos = createMemo(() => buildCombos(props.catalog));

  const filteredCombos = createMemo(() => {
    let rows = allCombos();
    const af = archFilter();
    const tf = tierFilter();
    if (af) rows = rows.filter(r => r.hubType.id === af);
    if (tf) {
      rows = rows.filter(r => {
        const sensorMatch = r.sensorTier.badge.toLowerCase() === tf;
        const hubMatch = !r.hubTier || r.hubTier.badge.toLowerCase() === tf;
        return sensorMatch && hubMatch;
      });
    }
    return rows;
  });

  const columns: ColumnDef<BuildCombo>[] = [
    {
      id: 'hubType',
      accessorKey: 'hubType',
      header: 'Architecture',
      size: 140,
      minSize: 60,
      enableHiding: false,
      cell: (info) => {
        const ht = info.row.original.hubType;
        return (
          <span class={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-medium ${badgeStyles[ht.badgeClass] || ''}`}>
            {ht.badge}
          </span>
        );
      },
      sortingFn: (a, b) => a.original.hubType.name.localeCompare(b.original.hubType.name),
    },
    {
      id: 'hubTier',
      accessorKey: 'hubTier',
      header: 'Hub',
      size: 180,
      minSize: 60,
      cell: (info) => {
        const tier = info.row.original.hubTier;
        if (!tier) return <span class="text-text-tertiary">—</span>;
        return (
          <div class="flex items-center gap-2">
            <span class="text-sm">{tier.name.replace(/^.*—\s*/, '')}</span>
            <span class={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm ${badgeStyles[tier.badgeClass] || ''}`}>
              {tier.badge}
            </span>
          </div>
        );
      },
      sortingFn: (a, b) => (a.original.hubCost) - (b.original.hubCost),
    },
    {
      id: 'hubCost',
      accessorKey: 'hubCost',
      header: 'Hub Cost',
      size: 100,
      minSize: 60,
      cell: (info) => {
        const cost = info.row.original.hubCost;
        return cost > 0
          ? <span class="font-mono text-sm">${cost}</span>
          : <span class="text-text-tertiary">—</span>;
      },
    },
    {
      id: 'sensorTier',
      accessorKey: 'sensorTier',
      header: 'Sensor',
      size: 180,
      minSize: 60,
      cell: (info) => {
        const tier = info.row.original.sensorTier;
        return (
          <div class="flex items-center gap-2">
            <span class="text-sm">{tier.name.replace(/^.*—\s*/, '')}</span>
            <span class={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm ${badgeStyles[tier.badgeClass] || ''}`}>
              {tier.badge}
            </span>
          </div>
        );
      },
      sortingFn: (a, b) => a.original.sensorCost - b.original.sensorCost,
    },
    {
      id: 'sensorCost',
      accessorKey: 'sensorCost',
      header: 'Sensor Cost',
      size: 110,
      minSize: 60,
      cell: (info) => <span class="font-mono text-sm">${info.row.original.sensorCost}</span>,
    },
    {
      id: 'battery',
      accessorKey: 'battery',
      header: 'Battery',
      size: 100,
      minSize: 60,
      cell: (info) => <span class="text-sm">{info.row.original.battery}</span>,
      enableSorting: false,
    },
    {
      id: 'commRange',
      accessorKey: 'commRange',
      header: 'Range',
      size: 100,
      minSize: 60,
      cell: (info) => <span class="text-sm">{info.row.original.commRange}</span>,
      enableSorting: false,
    },
    {
      id: 'totalAtFour',
      accessorKey: 'totalAtFour',
      header: 'Total (×4)',
      size: 110,
      minSize: 60,
      cell: (info) => <span class="font-mono text-sm font-medium text-accent">${info.row.original.totalAtFour}</span>,
    },
    {
      id: 'partCount',
      accessorKey: 'partCount',
      header: 'Parts',
      size: 80,
      minSize: 60,
      cell: (info) => <span class="font-mono text-sm text-text-tertiary">{info.row.original.partCount}</span>,
    },
    {
      id: 'action',
      header: '',
      size: 100,
      minSize: 60,
      enableResizing: false,
      cell: (info) => {
        const row = info.row.original;
        const params = new URLSearchParams();
        params.set('hub_type', row.hubType.id);
        if (row.hubTier) params.set('hub_tier', row.hubTier.id);
        params.set('sensor_tier', row.sensorTier.id);
        return (
          <a
            href={`/build?${params.toString()}`}
            class="text-xs text-accent hover:underline whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation();
              trackPreselection(
                row.hubType.id,
                row.hubTier?.id || null,
                row.sensorTier.id
              );
            }}
          >
            Build this &rarr;
          </a>
        );
      },
      enableSorting: false,
    },
  ];

  const columnLabels: Record<string, string> = {
    hubType: 'Architecture',
    hubTier: 'Hub',
    hubCost: 'Hub Cost',
    sensorTier: 'Sensor',
    sensorCost: 'Sensor Cost',
    battery: 'Battery',
    commRange: 'Range',
    totalAtFour: 'Total (×4)',
    partCount: 'Parts',
    action: 'Action',
  };

  const toggleableColumns = columns.filter(
    (col) => col.id !== 'hubType' && col.id !== 'action'
  );

  const table = createSolidTable({
    get data() { return filteredCombos(); },
    columns,
    state: {
      get sorting() { return sorting(); },
      get columnVisibility() { return columnVisibility(); },
      get globalFilter() { return globalFilter(); },
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const archOptions = [
    { value: 'none', label: 'Standalone' },
    { value: 'zigbee', label: 'Zigbee' },
    { value: 'lorawan', label: 'LoRaWAN' },
  ];

  const tierOptions = [
    { value: 'budget', label: 'Budget' },
    { value: 'premium', label: 'Premium' },
  ];

  async function deleteConfig(id: number) {
    const res = await fetch('/api/configs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setConfigs(prev => prev.filter(c => c.id !== id));
    }
  }

  function renderPartsTable(parts: Part[], label: string) {
    if (parts.length === 0) return null;
    return (
      <div class="mb-4">
        <div class="text-xs font-semibold text-text-secondary mb-2">{label}</div>
        <For each={parts}>
          {(part) => (
            <div class="flex justify-between py-1.5 border-b border-white/3 last:border-b-0 text-xs">
              <div>
                <span class="font-medium">{part.name}</span>
                <span class="text-text-tertiary ml-2">{part.description}</span>
              </div>
              <span class="font-mono text-text-secondary">${part.price}</span>
            </div>
          )}
        </For>
      </div>
    );
  }

  function toggleColumnVisibility(columnId: string) {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: prev[columnId] === false ? true : (prev[columnId] === undefined ? false : !prev[columnId]),
    }));
  }

  function isColumnVisible(columnId: string): boolean {
    const vis = columnVisibility();
    return vis[columnId] !== false;
  }

  return (
    <div class="mb-16">
      {/* Filters */}
      <div class="flex items-center gap-3 mb-6 flex-wrap">
        {/* Global search */}
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10 10l4 4" />
          </svg>
          <input
            type="text"
            placeholder="Search builds..."
            value={searchInput()}
            onInput={(e) => setSearchInput(e.currentTarget.value)}
            class="bg-bg-elevated border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors w-[200px]"
          />
        </div>

        {/* Architecture dropdown */}
        <Dropdown
          options={archOptions}
          value={archFilter()}
          onChange={setArchFilter}
          placeholder="All architectures"
        />

        {/* Tier dropdown */}
        <Dropdown
          options={tierOptions}
          value={tierFilter()}
          onChange={setTierFilter}
          placeholder="All tiers"
        />

        {/* Columns popover */}
        <div class="relative">
          <button
            ref={columnsButtonRef}
            type="button"
            class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-secondary cursor-pointer flex items-center gap-2 hover:border-border-hover transition-colors outline-none focus:border-border-active"
            onClick={() => setColumnsPopoverOpen(!columnsPopoverOpen())}
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
              <path d="M11.5 3h2" />
              <path d="M11.5 8h2" />
              <path d="M11.5 13h2" />
              <path d="M2.5 3h3.5" />
              <path d="M2.5 8h3.5" />
              <path d="M2.5 13h3.5" />
            </svg>
            <span>Columns</span>
          </button>

          <Show when={columnsPopoverOpen()}>
            <div
              ref={columnsPopoverRef}
              class="absolute z-50 mt-1 bg-bg-card border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-2 min-w-[180px] animate-[dropdown-in_0.15s_ease]"
            >
              <div class="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
                Toggle columns
              </div>
              <For each={toggleableColumns}>
                {(col) => (
                  <label class="flex items-center gap-2.5 px-3 py-1.5 text-sm text-text-primary hover:bg-bg-card-hover cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isColumnVisible(col.id!)}
                      onChange={() => toggleColumnVisibility(col.id!)}
                      class="accent-accent w-3.5 h-3.5"
                    />
                    <span>{columnLabels[col.id!] || col.id}</span>
                  </label>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Separator and count */}
        <div class="flex items-center gap-3 ml-auto">
          <div class="w-px h-5 bg-border" />
          <span class="text-xs text-text-tertiary whitespace-nowrap">
            {table.getRowModel().rows.length} of {allCombos().length} combinations
          </span>
        </div>
      </div>

      {/* Matrix table */}
      <div class="border border-border rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left" style={{ "min-width": `${table.getTotalSize()}px` }}>
            <thead>
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <tr class="border-b border-border bg-bg-surface">
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th
                          class={`group relative px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary font-medium ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-text-secondary' : ''
                          }`}
                          colSpan={header.colSpan}
                          style={{ width: `${header.getSize()}px` }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <Show when={!header.isPlaceholder}>
                            <div class="flex items-center gap-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <Show when={header.column.getIsSorted()}>
                                <span class="text-accent">
                                  {header.column.getIsSorted() === 'asc' ? ' \u2191' : ' \u2193'}
                                </span>
                              </Show>
                            </div>
                          </Show>
                          <Show when={header.column.getCanResize()}>
                            <div
                              class={`w-1 h-full bg-border hover:bg-accent cursor-col-resize absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                                header.column.getIsResizing() ? 'bg-accent opacity-100' : ''
                              }`}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Show>
                        </th>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </thead>
            <tbody>
              <For each={table.getRowModel().rows}>
                {(row, idx) => (
                  <>
                    <tr
                      class={`border-b border-white/3 hover:bg-bg-card-hover/50 cursor-pointer transition-colors border-l-2 ${
                        borderColors[row.original.hubType.id] || 'border-l-transparent'
                      } ${expandedRow() === idx() ? 'bg-bg-card-hover/30' : ''}`}
                      onClick={() => setExpandedRow(expandedRow() === idx() ? null : idx())}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td class="px-4 py-3" style={{ width: `${cell.column.getSize()}px` }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </For>
                    </tr>
                    <Show when={expandedRow() === idx()}>
                      <tr class="border-b border-white/3 bg-bg-surface/50">
                        <td colSpan={row.getVisibleCells().length} class="px-8 py-6">
                          <div class="grid grid-cols-2 max-md:grid-cols-1 gap-6">
                            {renderPartsTable(row.original.hubParts, `Hub parts — ${row.original.hubTier?.name || 'None'}`)}
                            {renderPartsTable(row.original.sensorParts, `Sensor parts — ${row.original.sensorTier.name}`)}
                          </div>
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved configurations */}
      <Show when={configs().length > 0}>
        <div class="mt-12">
          <h2 class="text-lg font-semibold mb-4">Saved configurations</h2>
          <div class="border border-border rounded-xl overflow-hidden">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-border bg-bg-surface">
                  <th class="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">Name</th>
                  <th class="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">Config</th>
                  <th class="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">Qty</th>
                  <th class="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">Actions</th>
                </tr>
              </thead>
              <tbody>
                <For each={configs()}>
                  {(config) => {
                    const params = new URLSearchParams();
                    params.set('hub_type', config.hubTypeId);
                    if (config.hubTierId) params.set('hub_tier', config.hubTierId);
                    params.set('sensor_tier', config.sensorTierId);
                    return (
                      <tr class="border-b border-white/3 hover:bg-bg-card-hover/50 transition-colors">
                        <td class="px-4 py-3 text-sm font-medium">{config.name}</td>
                        <td class="px-4 py-3 text-xs text-text-secondary font-mono">
                          {config.hubTypeId} / {config.hubTierId || '—'} / {config.sensorTierId}
                        </td>
                        <td class="px-4 py-3 font-mono text-sm">{config.qty}</td>
                        <td class="px-4 py-3">
                          <div class="flex items-center gap-3">
                            <a href={`/build?${params.toString()}`} class="text-xs text-accent hover:underline">
                              Load
                            </a>
                            <button
                              onClick={() => deleteConfig(config.id)}
                              class="text-xs text-accent-coral hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default SummaryTable;
