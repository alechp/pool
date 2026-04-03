import type { Component } from 'solid-js';
import type { HardwareVisualVariant } from '../lib/hardwareVisuals';

interface Props {
  variant: HardwareVisualVariant;
  title?: string;
  class?: string;
}

type Palette = {
  accent: string;
  glow: string;
  shell: string;
  shell2: string;
  line: string;
  plate: string;
};

const paletteMap: Record<HardwareVisualVariant, Palette> = {
  'gateway-zigbee-budget': { accent: '#8b5cf6', glow: '#a78bfa55', shell: '#202331', shell2: '#141722', line: '#c4b5fd', plate: '#3b4260' },
  'gateway-zigbee-premium': { accent: '#60a5fa', glow: '#60a5fa55', shell: '#222733', shell2: '#151a24', line: '#93c5fd', plate: '#4b5f7d' },
  'gateway-lora-budget': { accent: '#f59e0b', glow: '#f59e0b55', shell: '#25211c', shell2: '#17120d', line: '#fcd34d', plate: '#5d4730' },
  'gateway-lora-premium': { accent: '#22c55e', glow: '#22c55e55', shell: '#1a2721', shell2: '#101a15', line: '#86efac', plate: '#385948' },
  'sensor-standalone-budget': { accent: '#14b8a6', glow: '#14b8a655', shell: '#1a2630', shell2: '#111923', line: '#5eead4', plate: '#305160' },
  'sensor-standalone-premium': { accent: '#3b82f6', glow: '#3b82f655', shell: '#192538', shell2: '#0f1625', line: '#93c5fd', plate: '#38557a' },
  'sensor-zigbee-budget': { accent: '#a855f7', glow: '#a855f755', shell: '#241c32', shell2: '#171224', line: '#d8b4fe', plate: '#56406f' },
  'sensor-zigbee-premium': { accent: '#6366f1', glow: '#6366f155', shell: '#1b1f38', shell2: '#111425', line: '#a5b4fc', plate: '#434b80' },
  'sensor-lora-budget': { accent: '#f97316', glow: '#f9731655', shell: '#2b1d16', shell2: '#18100c', line: '#fdba74', plate: '#654432' },
  'sensor-lora-premium': { accent: '#06b6d4', glow: '#06b6d455', shell: '#152936', shell2: '#0d1921', line: '#67e8f9', plate: '#356375' },
  'part-board': { accent: '#10b981', glow: '#10b98155', shell: '#16241d', shell2: '#0f1814', line: '#6ee7b7', plate: '#294638' },
  'part-camera': { accent: '#3b82f6', glow: '#3b82f655', shell: '#1a2230', shell2: '#101622', line: '#93c5fd', plate: '#364c68' },
  'part-radar': { accent: '#f59e0b', glow: '#f59e0b55', shell: '#2a2115', shell2: '#17120c', line: '#fde68a', plate: '#5e4c2f' },
  'part-battery': { accent: '#22c55e', glow: '#22c55e55', shell: '#1a241d', shell2: '#111713', line: '#86efac', plate: '#3f5e44' },
  'part-enclosure': { accent: '#94a3b8', glow: '#94a3b855', shell: '#232733', shell2: '#181b24', line: '#cbd5e1', plate: '#4c5467' },
  'part-wiring': { accent: '#ef4444', glow: '#ef444455', shell: '#29171a', shell2: '#170d0f', line: '#fca5a5', plate: '#6a343b' },
  'part-power': { accent: '#f97316', glow: '#f9731655', shell: '#291d17', shell2: '#18100c', line: '#fdba74', plate: '#684536' },
  'part-storage': { accent: '#8b5cf6', glow: '#8b5cf655', shell: '#20192a', shell2: '#140f19', line: '#c4b5fd', plate: '#4a3b5d' },
  'part-antenna': { accent: '#eab308', glow: '#eab30855', shell: '#261f10', shell2: '#171209', line: '#fde047', plate: '#615224' },
  'part-audio': { accent: '#ec4899', glow: '#ec489955', shell: '#2a1824', shell2: '#170d14', line: '#f9a8d4', plate: '#6a3757' },
  'part-accessory': { accent: '#38bdf8', glow: '#38bdf855', shell: '#172630', shell2: '#0c171e', line: '#7dd3fc', plate: '#325261' },
};

const HardwareThumbnail: Component<Props> = (props) => {
  const palette = () => paletteMap[props.variant];
  const kind = () => props.variant.startsWith('gateway') ? 'gateway' : props.variant.startsWith('sensor') ? 'sensor' : 'part';

  return (
    <div class={`overflow-hidden rounded-2xl border border-white/8 bg-[#0f1218] shadow-[0_18px_40px_rgba(0,0,0,0.35)] ${props.class ?? ''}`}>
      <svg viewBox="0 0 320 220" class="block h-full w-full" role="img" aria-label={props.title ?? props.variant}>
        <defs>
          <linearGradient id={`bg-${props.variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color={palette().shell} />
            <stop offset="100%" stop-color={palette().shell2} />
          </linearGradient>
          <radialGradient id={`glow-${props.variant}`} cx="50%" cy="38%" r="60%">
            <stop offset="0%" stop-color={palette().glow} />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
          <linearGradient id={`metal-${props.variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff18" />
            <stop offset="100%" stop-color="#ffffff04" />
          </linearGradient>
        </defs>

        <rect width="320" height="220" rx="24" fill={`url(#bg-${props.variant})`} />
        <rect width="320" height="220" rx="24" fill={`url(#glow-${props.variant})`} />
        <g opacity="0.16" stroke="#ffffff" stroke-width="1">
          <path d="M24 28h272" />
          <path d="M24 64h272" />
          <path d="M24 100h272" />
          <path d="M24 136h272" />
          <path d="M24 172h272" />
          <path d="M48 20v180" />
          <path d="M96 20v180" />
          <path d="M144 20v180" />
          <path d="M192 20v180" />
          <path d="M240 20v180" />
          <path d="M288 20v180" />
        </g>
        <ellipse cx="160" cy="184" rx="82" ry="18" fill={palette().glow} opacity="0.9" />

        {kind() === 'gateway' && (
          <g>
            <rect x="72" y="58" width="176" height="104" rx="24" fill={palette().plate} />
            <rect x="82" y="50" width="156" height="96" rx="20" fill={`url(#metal-${props.variant})`} stroke={palette().line} stroke-width="1.4" />
            <rect x="102" y="76" width="74" height="46" rx="12" fill="#0a0d12" stroke="#ffffff22" />
            <circle cx="132" cy="98" r="16" fill={palette().accent} opacity="0.9" />
            <circle cx="132" cy="98" r="7" fill="#0a0d12" />
            <rect x="188" y="78" width="26" height="8" rx="4" fill={palette().line} opacity="0.75" />
            <rect x="188" y="94" width="34" height="8" rx="4" fill={palette().line} opacity="0.52" />
            <rect x="188" y="110" width="20" height="8" rx="4" fill={palette().line} opacity="0.35" />
            <path d="M98 58l-12-28" stroke={palette().line} stroke-width="4" stroke-linecap="round" />
            <path d="M222 58l12-28" stroke={palette().line} stroke-width="4" stroke-linecap="round" />
            <circle cx="86" cy="28" r="4" fill={palette().accent} />
            <circle cx="234" cy="28" r="4" fill={palette().accent} />
          </g>
        )}

        {kind() === 'sensor' && (
          <g>
            <rect x="88" y="44" width="144" height="122" rx="30" fill={palette().plate} />
            <rect x="100" y="56" width="120" height="98" rx="24" fill={`url(#metal-${props.variant})`} stroke={palette().line} stroke-width="1.4" />
            <rect x="112" y="68" width="52" height="52" rx="16" fill="#0a0d12" stroke="#ffffff1f" />
            <circle cx="138" cy="94" r="14" fill={palette().accent} opacity="0.95" />
            <circle cx="138" cy="94" r="6" fill="#0a0d12" />
            <rect x="172" y="74" width="30" height="12" rx="6" fill="#ffffff18" />
            <rect x="172" y="94" width="22" height="12" rx="6" fill="#ffffff12" />
            <rect x="114" y="130" width="94" height="8" rx="4" fill={palette().line} opacity="0.38" />
            <circle cx="208" cy="128" r="9" fill={palette().accent} opacity="0.8" />
            <path d="M112 44l-18-16" stroke={palette().line} stroke-width="4" stroke-linecap="round" />
            <path d="M224 44l18-16" stroke={palette().line} stroke-width="4" stroke-linecap="round" />
          </g>
        )}

        {kind() === 'part' && (
          <g>
            <rect x="68" y="58" width="184" height="100" rx="26" fill={palette().plate} />
            <rect x="84" y="72" width="152" height="72" rx="20" fill={`url(#metal-${props.variant})`} stroke={palette().line} stroke-width="1.4" />
            <g>
              <circle cx="110" cy="94" r="10" fill={palette().accent} />
              <rect x="130" y="88" width="64" height="12" rx="6" fill={palette().line} opacity="0.7" />
              <rect x="130" y="108" width="86" height="10" rx="5" fill={palette().line} opacity="0.35" />
              <rect x="94" y="122" width="52" height="8" rx="4" fill="#ffffff16" />
            </g>
            <path d="M74 50h46" stroke={palette().line} stroke-width="5" stroke-linecap="round" opacity="0.55" />
            <path d="M200 50h46" stroke={palette().line} stroke-width="5" stroke-linecap="round" opacity="0.55" />
          </g>
        )}

        <text x="26" y="30" fill="#d7dde8" opacity="0.85" font-size="12" font-family="DM Mono, monospace">
          {props.title ?? ''}
        </text>
      </svg>
    </div>
  );
};

export default HardwareThumbnail;
