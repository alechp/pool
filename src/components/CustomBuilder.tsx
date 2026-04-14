import { createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Catalog, Part } from '../lib/data';
import { Check } from 'lucide-solid';

interface CustomBuilderProps {
  catalog: Catalog;
}

type ArchOption = {
  id: string;
  label: string;
  description: string;
};

type UniquePart = {
  name: string;
  description: string;
  price: number;
  partType: 'hub' | 'sensor';
  sortOrder: number;
};

const archOptions: ArchOption[] = [
  { id: 'none', label: 'Standalone', description: 'WiFi-direct, no hub needed' },
  { id: 'zigbee', label: 'Zigbee', description: 'Mesh network with hub coordinator' },
  { id: 'lorawan', label: 'LoRaWAN', description: 'Long-range gateway, km coverage' },
];

function collectParts(catalog: Catalog, archId: string, partType: 'hub' | 'sensor'): UniquePart[] {
  const seen = new Map<string, UniquePart>();

  if (partType === 'hub') {
    // Hub parts keyed by hub tier ID
    const tierIds = catalog.hubTiers
      .filter(t => t.hubTypeId === archId)
      .map(t => t.id);
    for (const tid of tierIds) {
      const parts = catalog.hubParts[tid] || [];
      for (const p of parts) {
        if (!seen.has(p.name)) {
          seen.set(p.name, {
            name: p.name,
            description: p.description,
            price: p.price,
            partType: 'hub',
            sortOrder: p.sortOrder,
          });
        }
      }
    }
  } else {
    // Sensor parts keyed by sensor tier ID
    let tierIds: string[];
    if (archId === 'none') {
      tierIds = catalog.sensorTiers
        .filter(t => t.hubTypeId === 'none')
        .map(t => t.id);
    } else if (archId === 'zigbee') {
      tierIds = catalog.sensorTiers
        .filter(t => t.hubTypeId === 'zigbee')
        .map(t => t.id);
    } else {
      tierIds = catalog.sensorTiers
        .filter(t => t.hubTypeId === 'lorawan')
        .map(t => t.id);
    }
    for (const tid of tierIds) {
      const parts = catalog.sensorParts[tid] || [];
      for (const p of parts) {
        if (!seen.has(p.name)) {
          seen.set(p.name, {
            name: p.name,
            description: p.description,
            price: p.price,
            partType: 'sensor',
            sortOrder: p.sortOrder,
          });
        }
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

const CustomBuilder: Component<CustomBuilderProps> = (props) => {
  const [arch, setArch] = createSignal<string | null>(null);
  const [selectedHubParts, setSelectedHubParts] = createSignal<Set<number>>(new Set());
  const [selectedSensorParts, setSelectedSensorParts] = createSignal<Set<number>>(new Set());
  const [qty, setQty] = createSignal(4);
  const [buildName, setBuildName] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  const availableHubParts = createMemo(() => {
    const a = arch();
    if (!a || a === 'none') return [];
    return collectParts(props.catalog, a, 'hub');
  });

  const availableSensorParts = createMemo(() => {
    const a = arch();
    if (!a) return [];
    return collectParts(props.catalog, a, 'sensor');
  });

  // Reset selections when architecture changes
  createEffect(() => {
    const _ = arch();
    setSelectedHubParts(new Set());
    setSelectedSensorParts(new Set());
    setSaved(false);
    setSaveError(null);
  });

  function toggleHubPart(index: number) {
    const current = new Set(selectedHubParts());
    if (current.has(index)) {
      current.delete(index);
    } else {
      current.add(index);
    }
    setSelectedHubParts(current);
    setSaved(false);
  }

  function toggleSensorPart(index: number) {
    const current = new Set(selectedSensorParts());
    if (current.has(index)) {
      current.delete(index);
    } else {
      current.add(index);
    }
    setSelectedSensorParts(current);
    setSaved(false);
  }

  const hubTotal = createMemo(() => {
    let total = 0;
    const parts = availableHubParts();
    for (const idx of selectedHubParts()) {
      if (parts[idx]) total += parts[idx].price;
    }
    return total;
  });

  const sensorUnitCost = createMemo(() => {
    let total = 0;
    const parts = availableSensorParts();
    for (const idx of selectedSensorParts()) {
      if (parts[idx]) total += parts[idx].price;
    }
    return total;
  });

  const sensorTotal = createMemo(() => sensorUnitCost() * qty());
  const grandTotal = createMemo(() => hubTotal() + sensorTotal());

  const autoName = createMemo(() => {
    const a = arch();
    if (!a) return 'Custom Build';
    const archLabel = archOptions.find(o => o.id === a)?.label || a;
    return `Custom ${archLabel} Build`;
  });

  // Compute total price in cents for the API
  const totalPriceCents = createMemo(() => Math.round(grandTotal() * 100));

  async function saveBuild() {
    const a = arch();
    if (!a) return;

    setSaving(true);
    setSaveError(null);

    const hubParts = availableHubParts();
    const sensorPartsArr = availableSensorParts();

    const parts: Array<{
      partType: string;
      partName: string;
      partDescription: string;
      price: number;
      sortOrder: number;
    }> = [];

    let order = 1;
    for (const idx of Array.from(selectedHubParts()).sort((a, b) => a - b)) {
      const p = hubParts[idx];
      if (p) {
        parts.push({
          partType: 'hub',
          partName: p.name,
          partDescription: p.description,
          price: Math.round(p.price * 100),
          sortOrder: order++,
        });
      }
    }
    for (const idx of Array.from(selectedSensorParts()).sort((a, b) => a - b)) {
      const p = sensorPartsArr[idx];
      if (p) {
        parts.push({
          partType: 'sensor',
          partName: p.name,
          partDescription: p.description,
          price: Math.round(p.price * 100),
          sortOrder: order++,
        });
      }
    }

    try {
      const res = await fetch('/api/custom-builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: buildName() || autoName(),
          hubTypeId: a,
          sensorQty: qty(),
          totalPrice: totalPriceCents(),
          parts,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const hasSelections = createMemo(() =>
    selectedHubParts().size > 0 || selectedSensorParts().size > 0
  );

  return (
    <div class="pb-16">
      {/* Architecture selector */}
      <div class="mb-10">
        <div class="mb-4">
          <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 01</div>
          <h2 class="text-2xl font-semibold tracking-tight">Choose architecture</h2>
          <p class="text-sm text-text-secondary mt-1">Select the communication protocol for your custom build.</p>
        </div>
        <div class="grid grid-cols-3 max-md:grid-cols-1 gap-3">
          <For each={archOptions}>
            {(option) => (
              <div
                class={`relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all border ${
                  arch() === option.id
                    ? 'border-border-active bg-bg-card-hover'
                    : 'border-border bg-bg-card hover:border-border-hover hover:bg-bg-card-hover'
                }`}
                onClick={() => setArch(option.id)}
              >
                <div
                  class={`absolute top-0 left-0 right-0 h-0.5 transition-colors ${
                    arch() === option.id ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
                <div class="flex items-start justify-between mb-2">
                  <span class="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-medium bg-white/6 text-text-secondary">
                    {option.id === 'none' ? 'wifi' : option.id}
                  </span>
                  <div
                    class={`w-[18px] h-[18px] rounded-full border-2 transition-all flex-shrink-0 ${
                      arch() === option.id
                        ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg-card-hover)]'
                        : 'border-text-tertiary'
                    }`}
                  />
                </div>
                <h3 class="text-base font-semibold tracking-tight mb-1">{option.label}</h3>
                <p class="text-[13px] text-text-secondary leading-relaxed">{option.description}</p>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={arch()}>
        {/* Hub Parts (if arch != 'none') */}
        <Show when={arch() !== 'none' && availableHubParts().length > 0}>
          <div class="mb-10 animate-[fade-up_0.4s_ease]">
            <div class="mb-4">
              <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 02</div>
              <h2 class="text-2xl font-semibold tracking-tight">Hub parts</h2>
              <p class="text-sm text-text-secondary mt-1">Select individual hub components. Deduped across budget and premium tiers.</p>
            </div>
            <div class="bg-bg-card border border-border rounded-xl overflow-hidden">
              <For each={availableHubParts()}>
                {(part, index) => {
                  const isSelected = () => selectedHubParts().has(index());
                  return (
                    <label class="flex items-center gap-3 py-3 px-4 border-b border-white/3 last:border-b-0 hover:bg-bg-card-hover/30 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isSelected()}
                        onChange={() => toggleHubPart(index())}
                        class="w-4 h-4 accent-accent"
                      />
                      <div class="flex-1">
                        <div class="text-sm font-medium">{part.name}</div>
                        <div class="text-xs text-text-tertiary mt-0.5">{part.description}</div>
                      </div>
                      <div class="font-mono text-sm font-medium">${part.price}</div>
                    </label>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Sensor Parts */}
        <Show when={availableSensorParts().length > 0}>
          <div class="mb-10 animate-[fade-up_0.4s_ease]">
            <div class="mb-4">
              <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">
                {arch() === 'none' ? 'Step 02' : 'Step 03'}
              </div>
              <h2 class="text-2xl font-semibold tracking-tight">Sensor parts</h2>
              <p class="text-sm text-text-secondary mt-1">Select components for each sensor unit. Deduped across budget and premium tiers.</p>
            </div>
            <div class="bg-bg-card border border-border rounded-xl overflow-hidden">
              <For each={availableSensorParts()}>
                {(part, index) => {
                  const isSelected = () => selectedSensorParts().has(index());
                  return (
                    <label class="flex items-center gap-3 py-3 px-4 border-b border-white/3 last:border-b-0 hover:bg-bg-card-hover/30 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isSelected()}
                        onChange={() => toggleSensorPart(index())}
                        class="w-4 h-4 accent-accent"
                      />
                      <div class="flex-1">
                        <div class="text-sm font-medium">{part.name}</div>
                        <div class="text-xs text-text-tertiary mt-0.5">{part.description}</div>
                      </div>
                      <div class="font-mono text-sm font-medium">${part.price}</div>
                    </label>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        {/* Qty slider */}
        <Show when={hasSelections()}>
          <div class="mb-10 animate-[fade-up_0.4s_ease]">
            <div class="p-8 bg-bg-surface border border-border rounded-xl">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold">Fleet sizing</h2>
                <div class="flex items-center gap-3">
                  <label class="text-[13px] text-text-secondary">Sensors</label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={qty()}
                    step="1"
                    class="w-[140px]"
                    onInput={(e) => setQty(parseInt(e.currentTarget.value))}
                  />
                  <span class="font-mono text-lg font-medium min-w-[24px] text-center">{qty()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Running total + save */}
          <div class="animate-[fade-up_0.4s_ease]">
            <div class="p-6 bg-bg-surface border border-border rounded-xl">
              {/* Cost breakdown */}
              <div class="flex items-center justify-between gap-6 mb-6">
                <Show when={arch() !== 'none' && hubTotal() > 0}>
                  <div class="flex-1 bg-bg-card rounded-md p-4 border border-border">
                    <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1">Hub</div>
                    <div class="text-xl font-semibold tracking-tight">${hubTotal()}</div>
                  </div>
                </Show>
                <div class="flex-1 bg-bg-card rounded-md p-4 border border-border">
                  <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1">Sensor</div>
                  <div class="text-xl font-semibold tracking-tight">
                    ${sensorUnitCost()} <span class="text-sm text-text-tertiary font-normal">{'\u00D7'} {qty()} = ${sensorTotal()}</span>
                  </div>
                </div>
                <div class="flex-1 bg-bg-card rounded-md p-4 border border-border-active">
                  <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1">Total</div>
                  <div class="text-2xl font-semibold tracking-tight text-accent">${grandTotal()}</div>
                </div>
              </div>

              {/* Build name + save button */}
              <Show when={!saved()}>
                <div class="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder={autoName()}
                    value={buildName()}
                    onInput={(e) => setBuildName(e.currentTarget.value)}
                    class="flex-1 bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active"
                  />
                  <button
                    onClick={saveBuild}
                    disabled={saving()}
                    class="px-5 py-2.5 bg-accent text-bg-deep font-semibold text-sm rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50"
                  >
                    {saving() ? 'Saving...' : 'Save custom build'}
                  </button>
                </div>
              </Show>

              <Show when={saved()}>
                <div class="flex items-center gap-2 text-accent text-sm font-medium">
                  <Check size={16} class="text-accent" />
                  Custom build saved
                </div>
              </Show>

              <Show when={saveError()}>
                <div class="text-accent-coral text-sm mt-2">{saveError()}</div>
              </Show>
            </div>

            {/* Links */}
            <div class="flex items-center justify-between mt-6">
              <a href="/build" class="text-sm text-accent hover:underline">
                Back to guided wizard
              </a>
              <a href="/bom/compare" class="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
                Compare builds
              </a>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default CustomBuilder;
