import { createSignal, createMemo, createEffect, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Catalog, HubType, HubTier, SensorTier, Part } from '../lib/data';
import { Check } from 'lucide-solid';
import OptionCard from './OptionCard';
import Viewer3D from './Viewer3D';
import FleetSizer from './FleetSizer';

interface Props {
  catalog: Catalog;
  initialHubType?: string | null;
  initialHubTier?: string | null;
  initialSensorTier?: string | null;
}

const Configurator: Component<Props> = (props) => {
  // Resolve initial values from query params
  const initHubType = props.initialHubType || null;
  const initHubTier = props.initialHubTier
    ? props.catalog.hubTiers.find(t => t.id === props.initialHubTier) || null
    : null;
  const initSensorTier = props.initialSensorTier
    ? props.catalog.sensorTiers.find(t => t.id === props.initialSensorTier) || null
    : null;

  // If all pre-selected, start at step 4
  const initStep = initHubType && initSensorTier
    ? 4
    : 1;

  const [step, setStep] = createSignal(initStep);
  const [hubType, setHubType] = createSignal<string | null>(initHubType);
  const [hubTier, setHubTier] = createSignal<HubTier | null>(initHubTier);
  const [sensorTier, setSensorTier] = createSignal<SensorTier | null>(initSensorTier);
  const [qty, setQty] = createSignal(4);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [configName, setConfigName] = createSignal('');
  const [showSave, setShowSave] = createSignal(false);
  const [sessionId, setSessionId] = createSignal<number | null>(null);

  // On mount, create session
  createEffect(() => {
    if (!sessionId()) {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'started', source: 'wizard' }),
      }).then(r => r.json()).then(data => setSessionId(data.id)).catch(() => {});
    }
  });

  // Track step progress
  createEffect(() => {
    const sid = sessionId();
    const s = step();
    if (!sid || s === 1) return;
    const statusMap: Record<number, string> = { 2: 'step2', 3: 'step3', 4: 'completed' };
    fetch(`/api/sessions/${sid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: statusMap[s] || 'started',
        hubTypeId: hubType(),
        hubTierId: hubTier()?.id || null,
        sensorTierId: sensorTier()?.id || null,
        qty: qty(),
      }),
    }).catch(() => {});
  });

  const filteredHubTiers = createMemo(() =>
    props.catalog.hubTiers.filter(t => t.hubTypeId === hubType())
  );

  const filteredSensorTiers = createMemo(() =>
    props.catalog.sensorTiers.filter(t => t.hubTypeId === hubType())
  );

  const autoName = createMemo(() => {
    const parts: string[] = [];
    const ht = hubTier();
    const st = sensorTier();
    if (ht) parts.push(ht.name);
    if (st) parts.push(st.name);
    parts.push(`\u00D7 ${qty()}`);
    return parts.join(' + ');
  });

  const hubParts = createMemo(() => {
    const ht = hubTier();
    return ht ? (props.catalog.hubParts[ht.id] || []) : [];
  });

  const sensorParts = createMemo(() => {
    const st = sensorTier();
    return st ? (props.catalog.sensorParts[st.id] || []) : [];
  });

  function selectHubType(id: string) {
    setHubType(id);
    setHubTier(null);
    setSensorTier(null);
    setSaved(false);
    if (id === 'none') {
      setStep(3);
    } else {
      setStep(2);
    }
  }

  function selectHubTier(tier: HubTier) {
    setHubTier(tier);
    setSensorTier(null);
    setSaved(false);
    setStep(3);
  }

  function selectSensorTier(tier: SensorTier) {
    setSensorTier(tier);
    setSaved(false);
    setStep(4);
  }

  function goToStep(n: number) {
    if (n < step()) setStep(n);
  }

  function resetConfig() {
    setStep(1);
    setHubType(null);
    setHubTier(null);
    setSensorTier(null);
    setQty(4);
    setSaved(false);
    setSaveError(null);
    setShowSave(false);
  }

  async function saveConfig() {
    const st = sensorTier();
    const ht = hubType();
    if (!st || !ht) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configName() || autoName(),
          hubTypeId: ht,
          hubTierId: hubTier()?.id || null,
          sensorTierId: st.id,
          qty: qty(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
      setShowSave(false);

      // Track saved status (fire-and-forget)
      const sid = sessionId();
      if (sid) {
        fetch(`/api/sessions/${sid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'saved' }),
        }).catch(() => {});
      }
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const stepTabs = [
    { num: 1, label: 'Hub type' },
    { num: 2, label: 'Hub tier' },
    { num: 3, label: 'Sensor tier' },
    { num: 4, label: 'Review' },
  ];

  return (
    <div>
      {/* Step navigation */}
      <div class="flex gap-0.5 mb-12 bg-bg-surface rounded-xl p-1 border border-border">
        <For each={stepTabs}>
          {(tab) => (
            <div
              class={`flex-1 py-3 px-4 text-center text-[13px] font-medium rounded-lg cursor-pointer transition-all relative ${
                step() === tab.num
                  ? 'bg-bg-card text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                  : tab.num < step()
                  ? 'text-text-tertiary'
                  : 'text-text-tertiary'
              } ${tab.num === 2 && hubType() === 'none' ? 'opacity-30 pointer-events-none' : ''}`}
              onClick={() => goToStep(tab.num)}
            >
              <div class="flex items-center justify-center gap-1.5">
                <Show when={tab.num < step()}>
                  <Check size={14} class="text-accent" />
                </Show>
                <span class={`font-mono text-[11px] block mb-0.5 ${
                  step() === tab.num || tab.num < step() ? 'text-accent' : 'text-text-tertiary'
                }`}>
                  {String(tab.num).padStart(2, '0')}
                </span>
              </div>
              {tab.label}
            </div>
          )}
        </For>
      </div>

      {/* Step 1: Hub Type */}
      <Show when={step() === 1}>
        <div class="mb-12 animate-[fade-up_0.4s_ease]">
          <div class="mb-6">
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 01</div>
            <h2 class="text-2xl font-semibold tracking-tight">Choose your architecture</h2>
            <p class="text-sm text-text-secondary mt-1">Decide how sensors communicate with your AI stack.</p>
          </div>
          <div class="grid grid-cols-3 max-md:grid-cols-1 gap-3">
            <For each={props.catalog.hubTypes}>
              {(ht) => (
                <OptionCard
                  title={ht.name}
                  badge={ht.badge}
                  badgeClass={ht.badgeClass}
                  description={ht.description}
                  specs={ht.specs}
                  selected={hubType() === ht.id}
                  onClick={() => selectHubType(ht.id)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Step 2: Hub Tier */}
      <Show when={step() === 2}>
        <div class="mb-12 animate-[fade-up_0.4s_ease]">
          <div class="mb-6">
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 02</div>
            <h2 class="text-2xl font-semibold tracking-tight">
              Choose your {hubType() === 'zigbee' ? 'Zigbee hub' : 'LoRaWAN gateway'} tier
            </h2>
            <p class="text-sm text-text-secondary mt-1">Select the build quality for your central hub.</p>
          </div>
          <div class="grid grid-cols-2 max-md:grid-cols-1 gap-3">
            <For each={filteredHubTiers()}>
              {(tier) => (
                <OptionCard
                  title={tier.name}
                  badge={tier.badge}
                  badgeClass={tier.badgeClass}
                  description={tier.description}
                  price={tier.price}
                  priceNote="one-time"
                  specs={tier.specs}
                  selected={hubTier()?.id === tier.id}
                  onClick={() => selectHubTier(tier)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Step 3: Sensor Tier */}
      <Show when={step() === 3}>
        <div class="mb-12 animate-[fade-up_0.4s_ease]">
          <div class="mb-6">
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 03</div>
            <h2 class="text-2xl font-semibold tracking-tight">Choose your sensor tier</h2>
            <p class="text-sm text-text-secondary mt-1">
              Each sensor includes camera, mmWave radar, battery, and IP67 enclosure.
            </p>
          </div>
          <div class="grid grid-cols-2 max-md:grid-cols-1 gap-3">
            <For each={filteredSensorTiers()}>
              {(tier) => (
                <OptionCard
                  title={tier.name}
                  badge={tier.badge}
                  badgeClass={tier.badgeClass}
                  description={tier.description}
                  price={tier.price}
                  priceNote="per unit"
                  specs={tier.specs}
                  selected={sensorTier()?.id === tier.id}
                  onClick={() => selectSensorTier(tier)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Step 4: Review */}
      <Show when={step() === 4 && sensorTier()}>
        <div class="mb-12 animate-[fade-up_0.4s_ease]">
          <div class="mb-6">
            <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent mb-1.5">Step 04</div>
            <h2 class="text-2xl font-semibold tracking-tight">Your build</h2>
            <p class="text-sm text-text-secondary mt-1">Complete bill of materials with 3D preview. Adjust fleet size below.</p>
          </div>

          {/* 3D Viewer */}
          <Viewer3D accentColor={sensorTier()!.accentColor} visible={true} />

          {/* BOM */}
          <div class="my-12">
            <Show when={hubTier()}>
              <div class="mb-8">
                <div class="flex items-center gap-2.5 mb-3 pb-2 border-b border-border">
                  <h3 class="text-sm font-semibold">Hub -- {hubTier()!.name}</h3>
                  <span class="font-mono text-[11px] text-text-tertiary bg-white/4 px-2 py-0.5 rounded-full">
                    {hubParts().length} parts
                  </span>
                </div>
                <For each={hubParts()}>
                  {(part) => (
                    <div class="grid grid-cols-[1fr_auto] gap-4 py-2.5 border-b border-white/3 last:border-b-0 items-center">
                      <div>
                        <div class="text-sm font-medium">{part.name}</div>
                        <div class="text-xs text-text-tertiary mt-0.5">{part.description}</div>
                      </div>
                      <div class="font-mono text-sm font-medium text-right whitespace-nowrap">
                        ${part.price}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <div class="mb-8">
              <div class="flex items-center gap-2.5 mb-3 pb-2 border-b border-border">
                <h3 class="text-sm font-semibold">Sensor -- {sensorTier()!.name}</h3>
                <span class="font-mono text-[11px] text-text-tertiary bg-white/4 px-2 py-0.5 rounded-full">
                  {sensorParts().length} parts
                </span>
              </div>
              <For each={sensorParts()}>
                {(part) => (
                  <div class="grid grid-cols-[1fr_auto] gap-4 py-2.5 border-b border-white/3 last:border-b-0 items-center">
                    <div>
                      <div class="text-sm font-medium">{part.name}</div>
                      <div class="text-xs text-text-tertiary mt-0.5">{part.description}</div>
                    </div>
                    <div class="font-mono text-sm font-medium text-right whitespace-nowrap">
                      ${part.price}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Fleet sizer */}
          <FleetSizer
            hubType={hubType()!}
            hubTier={hubTier()}
            sensorTier={sensorTier()!}
            qty={qty()}
            onQtyChange={setQty}
          />

          {/* Save / Actions */}
          <div class="flex items-center gap-4 mt-8">
            <Show when={!saved()}>
              <Show when={!showSave()} fallback={
                <div class="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder={autoName()}
                    value={configName()}
                    onInput={(e) => setConfigName(e.currentTarget.value)}
                    class="bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active w-80"
                  />
                  <button
                    onClick={saveConfig}
                    disabled={saving()}
                    class="px-5 py-2.5 bg-accent text-bg-deep font-semibold text-sm rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50"
                  >
                    {saving() ? 'Saving...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    class="px-4 py-2.5 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              }>
                <button
                  onClick={() => setShowSave(true)}
                  class="px-5 py-2.5 bg-accent text-bg-deep font-semibold text-sm rounded-lg hover:bg-accent-dim transition-colors"
                >
                  Save configuration
                </button>
              </Show>
            </Show>

            <Show when={saved()}>
              <div class="flex items-center gap-2 text-accent text-sm font-medium">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </div>
            </Show>

            <Show when={saveError()}>
              <span class="text-accent-coral text-sm">{saveError()}</span>
            </Show>

            <a href="/bom/compare" class="text-sm text-accent hover:underline ml-auto">Compare builds</a>

            <button
              onClick={resetConfig}
              class="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Configurator;
