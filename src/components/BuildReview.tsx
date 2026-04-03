import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { HubTier, SensorTier } from '../lib/data';
import FleetSizer from './FleetSizer';

interface Props {
  hubTypeId: string;
  hubTier: HubTier | null;
  sensorTier: SensorTier;
  configId?: number | null;
  forkFromId?: number | null;
  initialQty?: number;
  initialName?: string;
}

const BuildReview: Component<Props> = (props) => {
  const [qty, setQty] = createSignal(props.initialQty ?? 4);
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [configName, setConfigName] = createSignal(props.initialName ?? '');
  const [showSave, setShowSave] = createSignal(false);
  const [sessionId, setSessionId] = createSignal<number | null>(null);

  const autoName = createMemo(() => {
    const parts: string[] = [];
    if (props.hubTier) parts.push(props.hubTier.name);
    parts.push(props.sensorTier.name);
    parts.push(`x ${qty()}`);
    return parts.join(' + ');
  });

  createEffect(() => {
    if (sessionId()) return;

    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        source: 'wizard',
        hubTypeId: props.hubTypeId,
        hubTierId: props.hubTier?.id ?? null,
        sensorTierId: props.sensorTier.id,
        qty: qty(),
      }),
    })
      .then((response) => response.json())
      .then((data) => setSessionId(data.id))
      .catch(() => {});
  });

  createEffect(() => {
    const sid = sessionId();
    if (!sid) return;

    fetch(`/api/sessions/${sid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: saved() ? 'saved' : 'completed',
        hubTypeId: props.hubTypeId,
        hubTierId: props.hubTier?.id ?? null,
        sensorTierId: props.sensorTier.id,
        qty: qty(),
      }),
    }).catch(() => {});
  });

  async function saveConfig() {
    setSaving(true);
    setSaveError(null);

    try {
      const isEditing = Boolean(props.configId);
      const response = await fetch(isEditing ? `/api/configs/${props.configId}` : '/api/configs', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: configName().trim() || autoName(),
          hubTypeId: props.hubTypeId,
          hubTierId: props.hubTier?.id ?? null,
          sensorTierId: props.sensorTier.id,
          qty: qty(),
          forkFromId: props.forkFromId ?? null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
      setShowSave(false);
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function resetReviewState() {
    setQty(4);
    setSaved(false);
    setSaveError(null);
    setShowSave(false);
    setConfigName('');
  }

  return (
    <div>
      <FleetSizer
        hubType={props.hubTypeId}
        hubTier={props.hubTier}
        sensorTier={props.sensorTier}
        qty={qty()}
        onQtyChange={setQty}
      />

      <div class="flex items-center gap-4 mt-8 flex-wrap">
        <a
          href={`/bom?hub_type=${props.hubTypeId}&hub_tier=${props.hubTier?.id ?? ''}&sensor_tier=${props.sensorTier.id}&qty=${qty()}`}
          class="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/8"
        >
          Open BOM workspace
        </a>

        <Show when={!saved()}>
          <Show
            when={!showSave()}
            fallback={
              <div class="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder={autoName()}
                  value={configName()}
                  onInput={(e) => setConfigName(e.currentTarget.value)}
                  class="bg-bg-elevated border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active min-w-[18rem]"
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
            }
          >
            <button
              onClick={() => setShowSave(true)}
              class="px-5 py-2.5 bg-accent text-bg-deep font-semibold text-sm rounded-lg hover:bg-accent-dim transition-colors"
            >
              {props.configId ? 'Update configuration' : props.forkFromId ? 'Save fork' : 'Save configuration'}
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

        <a href="/" class="text-sm text-accent hover:underline ml-auto" data-astro-prefetch>View all builds</a>

        <button
          onClick={resetReviewState}
          class="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Reset review
        </button>
      </div>
    </div>
  );
};

export default BuildReview;
