import { createSignal, createMemo, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import {
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from '@tanstack/solid-table';
import type { Catalog, SavedConfig, BuildCombo, Part } from '../lib/data';
import { buildCombos } from '../lib/data';

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
      accessorKey: 'hubType',
      header: 'Architecture',
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
      accessorKey: 'hubTier',
      header: 'Hub',
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
      accessorKey: 'hubCost',
      header: 'Hub Cost',
      cell: (info) => {
        const cost = info.row.original.hubCost;
        return cost > 0
          ? <span class="font-mono text-sm">${cost}</span>
          : <span class="text-text-tertiary">—</span>;
      },
    },
    {
      accessorKey: 'sensorTier',
      header: 'Sensor',
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
      accessorKey: 'sensorCost',
      header: 'Sensor Cost',
      cell: (info) => <span class="font-mono text-sm">${info.row.original.sensorCost}</span>,
    },
    {
      accessorKey: 'battery',
      header: 'Battery',
      cell: (info) => <span class="text-sm">{info.row.original.battery}</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'commRange',
      header: 'Range',
      cell: (info) => <span class="text-sm">{info.row.original.commRange}</span>,
      enableSorting: false,
    },
    {
      accessorKey: 'totalAtFour',
      header: 'Total (×4)',
      cell: (info) => <span class="font-mono text-sm font-medium text-accent">${info.row.original.totalAtFour}</span>,
    },
    {
      accessorKey: 'partCount',
      header: 'Parts',
      cell: (info) => <span class="font-mono text-sm text-text-tertiary">{info.row.original.partCount}</span>,
    },
    {
      id: 'action',
      header: '',
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
            onClick={(e) => e.stopPropagation()}
          >
            Build this &rarr;
          </a>
        );
      },
      enableSorting: false,
    },
  ];

  const table = createSolidTable({
    get data() { return filteredCombos(); },
    columns,
    state: { get sorting() { return sorting(); } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  return (
    <div class="mb-16">
      {/* Filters */}
      <div class="flex gap-3 mb-6">
        <select
          class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-border-active"
          value={archFilter() || ''}
          onChange={(e) => setArchFilter(e.currentTarget.value || null)}
        >
          <option value="">All architectures</option>
          <option value="none">Standalone</option>
          <option value="zigbee">Zigbee</option>
          <option value="lorawan">LoRaWAN</option>
        </select>
        <select
          class="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-border-active"
          value={tierFilter() || ''}
          onChange={(e) => setTierFilter(e.currentTarget.value || null)}
        >
          <option value="">All tiers</option>
          <option value="budget">Budget</option>
          <option value="premium">Premium</option>
        </select>
        <span class="text-xs text-text-tertiary self-center ml-2">
          {filteredCombos().length} of {allCombos().length} combinations
        </span>
      </div>

      {/* Matrix table */}
      <div class="border border-border rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <tr class="border-b border-border bg-bg-surface">
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th
                          class={`px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-tertiary font-medium ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-text-secondary' : ''
                          }`}
                          colSpan={header.colSpan}
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
                          <td class="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </For>
                    </tr>
                    <Show when={expandedRow() === idx()}>
                      <tr class="border-b border-white/3 bg-bg-surface/50">
                        <td colSpan={columns.length} class="px-8 py-6">
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
