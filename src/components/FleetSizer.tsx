import { createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import type { HubTier, SensorTier } from '../lib/data';

interface Props {
  hubType: string;
  hubTier: HubTier | null;
  sensorTier: SensorTier;
  qty: number;
  onQtyChange: (n: number) => void;
}

const FleetSizer: Component<Props> = (props) => {
  const hubCost = createMemo(() => props.hubTier?.price ?? 0);
  const sensorTotal = createMemo(() => props.sensorTier.price * props.qty);
  const grandTotal = createMemo(() => hubCost() + sensorTotal());

  const coverage = createMemo(() => {
    const coverPerUnit = props.hubType === 'lorawan' ? 15 : 6;
    return Math.round(coverPerUnit * props.qty * coverPerUnit * 0.6);
  });

  const breakdown = createMemo(() => {
    const parts: string[] = [];
    if (hubCost() > 0) parts.push(`Hub: $${hubCost()}`);
    parts.push(`${props.qty}\u00D7 sensor @ $${props.sensorTier.price} = $${sensorTotal()}`);
    return parts.join(' + ');
  });

  const totalNote = createMemo(() => {
    if (hubCost() > 0) return `$${hubCost()} hub + $${sensorTotal()} sensors`;
    return `${props.qty} sensors, no hub`;
  });

  return (
    <div class="my-12 p-8 bg-bg-surface border border-border rounded-xl">
      {/* Header with slider */}
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Fleet sizing</h2>
        <div class="flex items-center gap-3">
          <label class="text-[13px] text-text-secondary">Sensors</label>
          <input
            type="range"
            min="1"
            max="8"
            value={props.qty}
            step="1"
            class="w-[140px]"
            onInput={(e) => props.onQtyChange(parseInt(e.currentTarget.value))}
          />
          <span class="font-mono text-lg font-medium min-w-[24px] text-center">{props.qty}</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div class="grid grid-cols-4 max-md:grid-cols-2 gap-3">
        {/* Total cost - highlighted */}
        <div class="bg-bg-card rounded-md p-4 border border-border-active">
          <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1.5">Total cost</div>
          <div class="text-2xl font-semibold tracking-tight text-accent">${grandTotal()}</div>
          <div class="text-[11px] text-text-tertiary mt-1">{totalNote()}</div>
        </div>

        {/* Coverage */}
        <div class="bg-bg-card rounded-md p-4 border border-border">
          <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1.5">Coverage</div>
          <div class="text-2xl font-semibold tracking-tight">~{coverage()} m&sup2;</div>
          <div class="text-[11px] text-text-tertiary mt-1">with 25% overlap</div>
        </div>

        {/* Battery */}
        <div class="bg-bg-card rounded-md p-4 border border-border">
          <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1.5">Battery life</div>
          <div class="text-2xl font-semibold tracking-tight">{props.sensorTier.battery}</div>
          <div class="text-[11px] text-text-tertiary mt-1">per sensor, deep sleep</div>
        </div>

        {/* Range */}
        <div class="bg-bg-card rounded-md p-4 border border-border">
          <div class="text-[11px] text-text-tertiary uppercase tracking-wider font-mono mb-1.5">Comm range</div>
          <div class="text-2xl font-semibold tracking-tight">{props.sensorTier.commRange}</div>
          <div class="text-[11px] text-text-tertiary mt-1">sensor to hub/server</div>
        </div>
      </div>

      {/* Total bar */}
      <div class="flex items-center justify-between p-5 bg-bg-card border border-border-active rounded-xl mt-6">
        <div>
          <div class="text-sm text-text-secondary">Grand total -- all hardware</div>
          <div class="font-mono text-xs text-text-tertiary mt-0.5">{breakdown()}</div>
        </div>
        <div class="font-mono text-[32px] font-medium text-accent">${grandTotal()}</div>
      </div>
    </div>
  );
};

export default FleetSizer;
