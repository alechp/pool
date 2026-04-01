import { For } from 'solid-js';
import type { Component } from 'solid-js';

// Badge class mapping to Tailwind classes
const badgeStyles: Record<string, string> = {
  'badge-budget': 'bg-accent/12 text-accent',
  'badge-premium': 'bg-accent-blue/12 text-accent-blue',
  'badge-none': 'bg-white/6 text-text-secondary',
  'badge-zigbee': 'bg-accent-purple/12 text-accent-purple',
  'badge-lora': 'bg-accent-amber/12 text-accent-amber',
};

interface Props {
  title: string;
  badge: string;
  badgeClass: string;
  description: string;
  price?: number;
  priceNote?: string;
  specs: string[];
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const OptionCard: Component<Props> = (props) => {
  return (
    <div
      class={`relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all border ${
        props.selected
          ? 'border-border-active bg-bg-card-hover'
          : 'border-border bg-bg-card hover:border-border-hover hover:bg-bg-card-hover'
      } ${props.disabled ? 'opacity-35 pointer-events-none grayscale-50' : ''}`}
      onClick={() => props.onClick()}
    >
      {/* Top accent bar */}
      <div
        class={`absolute top-0 left-0 right-0 h-0.5 transition-colors ${
          props.selected ? 'bg-accent' : 'bg-transparent'
        }`}
      />

      {/* Header: badge + radio */}
      <div class="flex items-start justify-between mb-2">
        <span
          class={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-medium ${
            badgeStyles[props.badgeClass] || 'bg-white/6 text-text-secondary'
          }`}
        >
          {props.badge}
        </span>
        <div
          class={`w-[18px] h-[18px] rounded-full border-2 transition-all flex-shrink-0 ${
            props.selected
              ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg-card-hover)]'
              : 'border-text-tertiary'
          }`}
        />
      </div>

      {/* Title */}
      <h3 class="text-base font-semibold tracking-tight mb-1">{props.title}</h3>

      {/* Description */}
      <p class="text-[13px] text-text-secondary leading-relaxed mb-3">{props.description}</p>

      {/* Price (optional) */}
      {props.price !== undefined && (
        <div class="mt-3">
          <span class="font-mono text-[22px] font-medium">${props.price}</span>
          {props.priceNote && (
            <span class="text-xs text-text-tertiary ml-1">{props.priceNote}</span>
          )}
        </div>
      )}

      {/* Spec pills */}
      <div class="flex flex-wrap gap-1.5 mt-2.5">
        <For each={props.specs}>
          {(spec) => (
            <span class="font-mono text-[11px] text-text-secondary bg-white/4 px-2 py-0.5 rounded-full border border-border">
              {spec}
            </span>
          )}
        </For>
      </div>
    </div>
  );
};

export default OptionCard;
