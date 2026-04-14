import { createSignal, createMemo, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { Home, Palmtree, Castle, Building2, TreePine, PiggyBank } from 'lucide-solid';
import type { Persona, PersonaBundle, Catalog } from '../lib/data';

interface PersonaGridProps {
  personas: Persona[];
  catalog: Catalog;
}

const iconMap: Record<string, Component<{ size?: number; class?: string }>> = {
  Home,
  Palmtree,
  Castle,
  Building2,
  TreePine,
  PiggyBank,
};

const importanceColors: Record<string, string> = {
  critical: 'text-accent-coral',
  high: 'text-accent-amber',
  medium: 'text-accent',
  low: 'text-text-tertiary',
};

const importanceBgColors: Record<string, string> = {
  critical: 'bg-accent-coral',
  high: 'bg-accent-amber',
  medium: 'bg-accent',
  low: 'bg-text-tertiary',
};

function trackPreselection(bundle: PersonaBundle) {
  fetch('/api/preselections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hubTypeId: bundle.hubTypeId,
      hubTierId: bundle.hubTierId,
      sensorTierId: bundle.sensorTierId,
      source: 'persona',
    }),
  }).catch(() => {});
}

function buildBundleUrl(bundle: PersonaBundle): string {
  const params = new URLSearchParams();
  params.set('hub_type', bundle.hubTypeId);
  if (bundle.hubTierId) params.set('hub_tier', bundle.hubTierId);
  params.set('sensor_tier', bundle.sensorTierId);
  return `/build?${params.toString()}`;
}

const PersonaGrid: Component<PersonaGridProps> = (props) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);

  const selectedPersona = createMemo(() =>
    props.personas.find(p => p.id === selectedId()) || null
  );

  return (
    <div class="pb-16">
      {/* Grid of persona cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <For each={props.personas}>
          {(persona) => {
            const IconComponent = iconMap[persona.icon];
            return (
              <div
                class={`p-6 rounded-xl border cursor-pointer transition-all hover:border-border-hover ${
                  selectedId() === persona.id
                    ? 'bg-bg-card border-accent/40 shadow-[0_0_20px_rgba(0,229,160,0.1)]'
                    : 'bg-bg-surface border-border hover:bg-bg-card'
                }`}
                onClick={() => setSelectedId(selectedId() === persona.id ? null : persona.id)}
              >
                <div class="mb-3">
                  <Show when={IconComponent} fallback={<Home size={28} class="text-text-secondary" />}>
                    {(_icon) => {
                      const Icon = iconMap[persona.icon];
                      return (
                        <Icon
                          size={28}
                          class={selectedId() === persona.id ? 'text-accent' : 'text-text-secondary'}
                        />
                      );
                    }}
                  </Show>
                </div>
                <h3 class="text-base font-semibold tracking-tight mb-1">{persona.name}</h3>
                <p class="text-[13px] text-text-secondary leading-relaxed">{persona.tagline}</p>
              </div>
            );
          }}
        </For>
      </div>

      {/* Detail panel */}
      <Show when={selectedPersona()}>
        {(persona) => (
          <div class="animate-[fade-up_0.4s_ease]">
            {/* Description */}
            <div class="mb-8 p-6 rounded-xl bg-bg-surface border border-border">
              <h2 class="text-xl font-semibold mb-2">{persona().name}</h2>
              <p class="text-sm text-text-secondary leading-relaxed">{persona().description}</p>
            </div>

            {/* Factors / Considerations */}
            <div class="mb-8">
              <h3 class="font-mono text-[11px] uppercase tracking-wider text-text-tertiary mb-4">
                Key Considerations
              </h3>
              <div class="rounded-xl bg-bg-surface border border-border p-5">
                <For each={persona().factors}>
                  {(factor) => {
                    const colorClass = importanceColors[factor.importance] || 'text-text-tertiary';
                    const bgClass = importanceBgColors[factor.importance] || 'bg-text-tertiary';
                    return (
                      <div class="flex items-center gap-3 py-2.5 border-b border-white/3 last:border-b-0">
                        <span class={`w-2 h-2 rounded-full flex-shrink-0 ${bgClass}`} />
                        <div class="flex-1">
                          <span class="text-sm font-medium">{factor.label}</span>
                          <span class="text-text-tertiary text-sm ml-2">{factor.value}</span>
                        </div>
                        <span class={`text-[10px] font-mono uppercase tracking-wider ${colorClass}`}>
                          {factor.importance}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Recommended Bundles */}
            <div>
              <h3 class="font-mono text-[11px] uppercase tracking-wider text-text-tertiary mb-4">
                Recommended Bundles
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <For each={persona().bundles}>
                  {(bundle) => {
                    const hubTier = props.catalog.hubTiers.find(t => t.id === bundle.hubTierId);
                    const sensorTier = props.catalog.sensorTiers.find(t => t.id === bundle.sensorTierId);
                    const hubCost = hubTier?.price || 0;
                    const sensorCost = (sensorTier?.price || 0) * bundle.qty;
                    const total = hubCost + sensorCost;
                    const buildUrl = buildBundleUrl(bundle);

                    return (
                      <div class={`p-5 rounded-xl border ${
                        bundle.sortOrder === 1
                          ? 'bg-bg-card border-accent/30'
                          : 'bg-bg-surface border-border'
                      }`}>
                        <div class="flex items-center gap-2 mb-3">
                          <Show when={bundle.sortOrder === 1}>
                            <span class="text-accent text-sm">&#9733;</span>
                          </Show>
                          <span class="font-mono text-[11px] uppercase tracking-wider text-text-tertiary">{bundle.label}</span>
                        </div>
                        <div class="text-sm font-medium mb-1">
                          {hubTier ? `${hubTier.name} + ` : ''}{sensorTier?.name} x {bundle.qty}
                        </div>
                        <div class="font-mono text-xl font-semibold text-accent mb-2">${total}</div>
                        <p class="text-xs text-text-tertiary mb-4">{bundle.reasoning}</p>
                        <a
                          href={buildUrl}
                          class="inline-block px-4 py-2 bg-accent text-bg-deep text-sm font-semibold rounded-lg hover:bg-accent-dim transition-colors"
                          onClick={() => trackPreselection(bundle)}
                        >
                          Build this &rarr;
                        </a>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default PersonaGrid;
