import { createEffect, createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import type { Component } from 'solid-js';
import Viewer3D from './Viewer3D';
import HubViewer3D from './HubViewer3D';
import {
  getHardwareExplorerAccentColors,
  type HardwareExplorerArchitecture as Architecture,
  type HardwareExplorerTier as Tier,
} from '../lib/hardwareVisuals';

type SummaryRow = {
  tierName: string;
  price: number;
  parts: string;
  accentColor: string;
};

type SummaryResponse = {
  sensor: SummaryRow;
  hub: SummaryRow | null;
};

const ARCHITECTURE_OPTIONS: Array<{ id: Architecture; label: string }> = [
  { id: 'standalone', label: 'Standalone (WiFi)' },
  { id: 'zigbee', label: 'Zigbee' },
  { id: 'lora', label: 'LoRaWAN' },
];

const TIER_OPTIONS: Array<{ id: Tier; label: string }> = [
  { id: 'budget', label: 'Budget' },
  { id: 'premium', label: 'Premium' },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatPrice(value: number | null | undefined) {
  return typeof value === 'number' ? money.format(value) : 'N/A';
}

function isSummaryResponse(value: unknown): value is SummaryResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as SummaryResponse;
  return (
    !!candidate.sensor &&
    typeof candidate.sensor.tierName === 'string' &&
    typeof candidate.sensor.price === 'number' &&
    typeof candidate.sensor.parts === 'string' &&
    typeof candidate.sensor.accentColor === 'string'
  );
}

function getResponsiveCanvasHeight() {
  if (typeof window === 'undefined') return 380;
  if (window.innerWidth < 768) return 300;
  if (window.innerWidth < 1024) return 320;
  return 380;
}

const HardwareExplorer: Component = () => {
  const [architecture, setArchitecture] = createSignal<Architecture>('standalone');
  const [tier, setTier] = createSignal<Tier>('budget');
  const [summary, setSummary] = createSignal<SummaryResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [refreshNonce, setRefreshNonce] = createSignal(0);
  const [canvasHeight, setCanvasHeight] = createSignal(380);
  const [reducedMotion, setReducedMotion] = createSignal(false);

  const fallbackAccents = createMemo(() => getHardwareExplorerAccentColors(architecture(), tier()));
  const sensorSummary = createMemo(() => summary()?.sensor ?? null);
  const hubSummary = createMemo(() => summary()?.hub ?? null);

  onMount(() => {
    setCanvasHeight(getResponsiveCanvasHeight());

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateCanvasHeight = () => setCanvasHeight(getResponsiveCanvasHeight());

    updateMotion();
    updateCanvasHeight();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateMotion);
      onCleanup(() => media.removeEventListener('change', updateMotion));
    } else if (typeof media.addListener === 'function') {
      media.addListener(updateMotion);
      onCleanup(() => media.removeListener(updateMotion));
    }

    window.addEventListener('resize', updateCanvasHeight);
    onCleanup(() => window.removeEventListener('resize', updateCanvasHeight));
  });

  createEffect(() => {
    if (typeof window === 'undefined') return;

    const arch = architecture();
    const currentTier = tier();
    refreshNonce();

    setLoading(true);
    setError(null);

    let controller: AbortController | undefined;
    const timer = window.setTimeout(() => {
      controller = new AbortController();
      const requestKey = `${arch}-${currentTier}`;

      fetch(`/api/hardware-summary?arch=${encodeURIComponent(arch)}&tier=${encodeURIComponent(currentTier)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = await response.text();
            throw new Error(body || `Request failed with status ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (!isSummaryResponse(data)) {
            throw new Error('Invalid hardware summary response.');
          }
          if (requestKey !== `${architecture()}-${tier()}`) return;
          setSummary(data);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (controller?.signal.aborted) return;
          if (requestKey !== `${architecture()}-${tier()}`) return;
          setSummary(null);
          setLoading(false);
          setError(err instanceof Error ? err.message : 'Failed to load hardware summary.');
        });
    }, 150);

    onCleanup(() => {
      window.clearTimeout(timer);
      controller?.abort();
    });
  });

  return (
    <div class="relative isolate overflow-hidden rounded-[2rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(0,229,160,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-6 py-10 md:px-10 md:py-12">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(56,189,248,0.14),transparent_22%),radial-gradient(circle_at_82%_16%,rgba(0,229,160,0.12),transparent_24%),radial-gradient(circle_at_50%_88%,rgba(255,255,255,0.04),transparent_28%)]" />

      <div class="relative z-10">
        <div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Hardware</div>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
          Explore the hardware that SwimSentry deploys.
        </h2>
        <p class="mt-3 max-w-[62ch] text-sm leading-7 text-text-secondary">
          Select an architecture and tier to see the actual sensor and hub components in 3D. Drag to rotate. Pricing
          reflects current supplier costs.
        </p>

        <div class="mt-8">
          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Architecture</div>
          <div class="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Architecture selector">
            <For each={ARCHITECTURE_OPTIONS}>
              {(option) => {
                const active = () => architecture() === option.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active()}
                    tabIndex={active() ? 0 : -1}
                    onClick={() => setArchitecture(option.id)}
                    class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      active()
                        ? 'border-accent/30 bg-accent/12 text-accent'
                        : 'border-white/8 bg-white/4 text-text-secondary hover:border-white/14'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <div class="mt-4">
          <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">Tier</div>
          <div class="mt-3 flex gap-2" role="radiogroup" aria-label="Tier selector">
            <For each={TIER_OPTIONS}>
              {(option) => {
                const active = () => tier() === option.id;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active()}
                    tabIndex={active() ? 0 : -1}
                    onClick={() => setTier(option.id)}
                    class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      active()
                        ? 'border-accent/30 bg-accent/12 text-accent'
                        : 'border-white/8 bg-white/4 text-text-secondary hover:border-white/14'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <Show when={error()}>
          <div class="mt-6 rounded-[1.25rem] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>{error()}</div>
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                class="rounded-full border border-red-300/25 bg-red-500/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-50 transition-colors hover:bg-red-500/20"
              >
                Retry
              </button>
            </div>
          </div>
        </Show>

        <div class="mt-8 grid gap-5 lg:grid-cols-2">
          <article class="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,10,14,0.92),rgba(8,9,13,0.99))] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
            <div class="mb-3 px-2">
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Sensor</div>
              <div class="mt-1 text-sm text-text-secondary">
                {loading() && !sensorSummary() ? 'Loading sensor BOM...' : sensorSummary()?.tierName ?? 'Sensor preview'}
              </div>
            </div>

            <Show
              when={sensorSummary()}
              fallback={
                <div class="grid gap-4">
                  <div class="rounded-[1.25rem] border border-white/6 bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.08),rgba(255,255,255,0.04))] bg-[length:240%_100%] animate-pulse" style={{ height: `${canvasHeight()}px` }} />
                  <div class="space-y-3 px-2">
                    <div class="h-4 w-2/5 rounded-full bg-white/8" />
                    <div class="h-3 w-full rounded-full bg-white/6" />
                    <div class="h-3 w-5/6 rounded-full bg-white/6" />
                  </div>
                </div>
              }
            >
              {(data) => (
                <Viewer3D
                  accentColor={data().accentColor || fallbackAccents().sensor}
                  visible={true}
                  label={data().tierName}
                  partSummary={data().parts}
                  price={formatPrice(data().price)}
                  canvasHeight={canvasHeight()}
                  reducedMotion={reducedMotion()}
                  ariaLabel={`${architecture()} ${tier()} SwimSentry sensor hardware model`}
                />
              )}
            </Show>
          </article>

          <article class="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,10,14,0.92),rgba(8,9,13,0.99))] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
            <div class="mb-3 px-2">
              <div class="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Hub</div>
              <div class="mt-1 text-sm text-text-secondary">
                <Switch>
                  <Match when={architecture() === 'standalone'}>
                    Standalone sensors connect directly over WiFi.
                  </Match>
                  <Match when={loading() && !hubSummary()}>Loading hub BOM...</Match>
                  <Match when={hubSummary()}>{hubSummary()?.tierName}</Match>
                  <Match when={true}>Hub preview</Match>
                </Switch>
              </div>
            </div>

            <HubViewer3D
              architecture={architecture()}
              tier={tier()}
              accentColor={hubSummary()?.accentColor ?? fallbackAccents().hub ?? fallbackAccents().sensor}
              visible={true}
              reducedMotion={reducedMotion()}
              canvasHeight={canvasHeight()}
              ariaLabel={
                architecture() === 'standalone'
                  ? 'Standalone sensors connect directly over WiFi and do not require a hub.'
                  : `${architecture()} ${tier()} SwimSentry hub hardware model`
              }
            />

            <div class="mt-4 space-y-3 px-1">
              <div class="flex items-baseline justify-between gap-4">
                <h3 class="text-base font-semibold text-text-primary">
                  {architecture() === 'standalone' ? 'Hub - N/A (WiFi)' : hubSummary()?.tierName ?? 'Hub preview'}
                </h3>
                <div class="font-mono text-sm font-semibold text-accent">
                  {architecture() === 'standalone' ? 'N/A' : formatPrice(hubSummary()?.price)}
                </div>
              </div>
              <p class="text-sm leading-7 text-text-secondary">
                {architecture() === 'standalone'
                  ? 'Direct WiFi only. No hub enclosure, gateway board, or coordinator hardware is required.'
                  : hubSummary()?.parts ?? 'Waiting for hub summary.'}
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default HardwareExplorer;
