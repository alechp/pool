# Landing Page Enhancements — ThreadPilled Diagram & 3D Hardware Explorer

## Status: Draft
## Date: 2026-04-07

---

## 1. Overview

Two additions to the SwimSentry configurator landing page (`src/pages/index.astro`):

1. **ThreadPilled Diagram (hero section)** — Upgrade the existing embed integration so the information-flow diagram is the visual anchor of the hero, with improved responsiveness and view transitions.
2. **3D Hardware Explorer (new section)** — A new full-width section below the hero that renders interactive Three.js models of both a **sensor node** and a **hub/gateway**, side by side, driven by the actual BOM component data in the database.

---

## 2. ThreadPilled Diagram — Hero Section Enhancements

### 2.1 Current State

The hero section (`src/components/LandingSignalScene.astro`) already:
- Mounts a `ThreadPilledVanillaEmbed` instance via `src/lib/threadpilledHomeEmbed.ts`
- Defines three TPD diagram sources inline (Overview, Build Flow, BOM Flow)
- Provides a custom dropdown to switch views
- Uses the dark theme preset with SwimSentry accent overrides (`#00e5a0`)

### 2.2 Changes Required

#### 2.2.1 Embed container improvements

| Item | Current | Target |
|------|---------|--------|
| Min height | 520px desktop / 430px mobile | 560px desktop / 460px mobile / 340px under 480px |
| Aspect ratio | None | `aspect-ratio: 16/10` as CSS fallback with `min-height` floor |
| Loading state | Blank dark rectangle | Skeleton pulse animation matching bg gradient until embed ready |
| Error state | Diagnostics panel overlay | Same panel + "Retry" button calling `mountThreadpilledHomeEmbed()` again |

#### 2.2.2 View transition animation

When the user switches views via the dropdown:

1. Current diagram fades out (150ms, `opacity 1→0`)
2. New TPD source is applied via `embed.update({ source })` (already implemented)
3. New diagram fades in (200ms, `opacity 0→1`)
4. Dropdown label updates to new view name (already implemented)

Implementation: wrap the `#swimsentry-threadpilled-home` div in a transition container. Use `requestAnimationFrame` timing — no external animation library needed.

#### 2.2.3 Diagram source refinements

No changes to the three TPD sources (Overview, Build Flow, BOM Flow). They already accurately represent the information flow. If new nodes are added later (e.g., a "Hardware Preview" pill linking to the 3D section below), add a fourth TPD source with view key `hardware`.

#### 2.2.4 Embed configuration update

```typescript
// src/lib/threadpilledHomeEmbed.ts — updated config
embed = new ThreadPilledVanillaEmbed(root, {
  source: validated.source,
  theme: {
    preset: 'dark',
    overrides: {
      bg: '#090b10',
      panelBg: '#0f141d',
      text: '#e8e9ed',
      textDim: '#93a0b4',
      accent: '#00e5a0',
    },
  },
  height: 560,                    // ← was 520
  showControls: false,
  showSourceToggle: false,
  showOpenInApp: false,
  accessibility: {
    ariaLabel: 'SwimSentry information flow diagram',
    reducedMotion: true,          // ← new: respect prefers-reduced-motion
  },
  layout: { density: 'spacious' },
  size: { fillContainer: true },
  events: {
    onPillClick: (data) => {      // ← new: pill click navigation
      handlePillNavigation(data.pillId);
    },
  },
});
```

#### 2.2.5 Pill click navigation (new)

When a user clicks a pill in the diagram, scroll to or navigate to the corresponding app section:

| Pill ID | Action |
|---------|--------|
| `user` | Scroll to HomeAdvisor section on same page |
| `advisor` | Scroll to HomeAdvisor section on same page |
| `build` | Navigate to `/build` |
| `bom` | Navigate to `/bom` |
| `system` | Scroll to 3D Hardware Explorer section (new, below) |

Implementation: a `handlePillNavigation(pillId: string)` function in `threadpilledHomeEmbed.ts` that uses `document.getElementById()` + `scrollIntoView({ behavior: 'smooth' })` for on-page targets, or `window.location.href` for page navigations.

---

## 3. 3D Hardware Explorer — New Section

### 3.1 Placement

Insert a new `<section>` in `src/pages/index.astro` between the hero (`<LandingSignalScene />`) and the advisor (`<HomeAdvisor />`):

```astro
<section class="py-10">
  <LandingSignalScene />
</section>

<!-- NEW: 3D Hardware Explorer -->
<section id="hardware-explorer" class="pb-14">
  <HardwareExplorer client:visible />
</section>

<section class="pb-10">
  <HomeAdvisor client:load />
</section>
```

Using `client:visible` so Three.js only initializes when the section scrolls into view.

### 3.2 Component: `HardwareExplorer.tsx`

**Location:** `src/components/HardwareExplorer.tsx`
**Framework:** Solid.js (consistent with existing components)
**Dependencies:** `three` (already in package.json at 0.183.2), `solid-js`

#### 3.2.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  HARDWARE                                                    │
│  Explore the hardware that SwimSentry deploys.               │
│                                                              │
│  ┌─ Architecture ─────────────────────────────────────────┐  │
│  │  [Standalone (WiFi)]  [Zigbee]  [LoRaWAN]             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ Tier ─────────────────────────────────────────────────┐  │
│  │  [Budget]  [Premium]                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────── Sensor ──────────┐ ┌──────────── Hub ───────┐ │
│  │                              │ │                         │ │
│  │     [3D Canvas — 380px]      │ │   [3D Canvas — 380px]  │ │
│  │                              │ │                         │ │
│  │  ┌─ 3D Preview ─ Drag ────┐  │ │  ┌─ 3D Preview ─ Drag┐ │ │
│  │  └────────────────────────┘  │ │  └────────────────────┘ │ │
│  │                              │ │                         │ │
│  │  Sensor — Standalone Budget  │ │  Hub — N/A (WiFi)      │ │
│  │  ──────────────────────────  │ │  ─────────────────────  │ │
│  │  ESP32-S3 · OV2640 · LD2410 │ │  Direct WiFi — no hub  │ │
│  │  350mAh LiPo · IP67 5.9"    │ │  required               │ │
│  │  $64 per unit               │ │                         │ │
│  └──────────────────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- On mobile (< 1024px): cards stack vertically, full width
- Architecture and tier selectors are pill-shaped toggle buttons (similar to existing Configurator step 1 buttons)

#### 3.2.2 State

```typescript
interface HardwareExplorerState {
  architecture: 'standalone' | 'zigbee' | 'lora';
  tier: 'budget' | 'premium';
}
```

Default: `{ architecture: 'standalone', tier: 'budget' }`

The architecture + tier combination determines:
- Which sensor BOM to display (maps to sensor tier IDs: `sa-cheap`, `sa-premium`, `zb-cheap`, `zb-premium`, `lr-cheap`, `lr-premium`)
- Which hub BOM to display (maps to hub tier IDs: `zigbee-cheap`, `zigbee-premium`, `lora-cheap`, `lora-premium`, or `null` for standalone)
- The accent color for both 3D models (from `src/lib/hardwareVisuals.ts`)

#### 3.2.3 Sensor 3D Canvas

Reuse and extract the existing `Viewer3D.tsx` component. It already renders a sensor with:
- Translucent IP67 enclosure, PCB, MCU, LED, camera, mmWave radar, battery, latches, cable gland, antenna, desiccant, standoffs
- Dynamic `accentColor` prop that recolors LED and camera iris
- Drag-to-rotate and auto-rotation
- 380px canvas height

Changes needed to `Viewer3D.tsx`:
- Accept a new optional `label` prop (`string`) to display the tier name below the canvas
- Accept a new optional `partSummary` prop (`string`) to show a one-line BOM summary
- Accept a new optional `price` prop (`string`) to show cost

No geometry changes — the procedural model is already accurate for all sensor tiers (the physical form factor is the same across tiers; only the internal board/camera/battery vary).

#### 3.2.4 Hub 3D Canvas — New Component: `HubViewer3D.tsx`

**Location:** `src/components/HubViewer3D.tsx`
**Framework:** Solid.js + Three.js (same pattern as `Viewer3D.tsx`)

The hub varies significantly by architecture, so three distinct model builders are needed:

##### Model A: Standalone (WiFi Direct) — No Hub

When `architecture === 'standalone'`, the hub panel shows a static message instead of a 3D canvas:

```
"Standalone sensors connect directly over WiFi — no hub required."
```

Render a simple SVG icon (antenna + WiFi waves) with the accent color, centered in the 380px space. No Three.js initialization.

##### Model B: Zigbee Hub

Two sub-variants:

**Budget ($28):** Loose components
- ESP32-C6 devboard (green PCB, 0.8 × 0.06 × 0.5 units, with USB-C port nub)
- USB-C wall adapter (white box, 0.3 × 0.5 × 0.3)
- Small ABS enclosure (opaque off-white box, 1.2 × 0.6 × 0.8, no clear lid)
- External antenna (short whip, same as sensor antenna)

**Premium ($225):** Integrated Raspberry Pi system
- Argon ONE V5 aluminum case (gunmetal, 1.6 × 0.5 × 1.0 units, with ventilation grooves on top modeled as thin recessed lines)
- Pi 5 board visible through translucent side panel (green PCB inside)
- SLZB-06 Zigbee coordinator (small USB-stick-sized dongle, 0.15 × 0.08 × 0.5, plugged into side)
- microSD card slot (thin slit on side)
- USB-C power cable (trailing from rear)
- Status LED (accent-colored, top-front)

##### Model C: LoRaWAN Gateway

Two sub-variants:

**Budget ($115):** Pi Zero + HAT stack
- Pi Zero 2W board (green PCB, very small: 0.65 × 0.04 × 0.3 units)
- SX1302 LoRa HAT stacked on top (second green PCB, slightly larger: 0.7 × 0.04 × 0.4 with gold RF connector)
- GPIO header pins between boards (gold cylinders, 2×20 array simplified as a gold strip)
- LoRa antenna (wire whip, 0.7 units tall)
- microSD card (protruding from edge)
- micro-USB power cable nub

**Premium ($265):** Full-size Pi + HAT with cooling
- Argon ONE V5 case (same as Zigbee premium but with antenna port hole on top)
- SX1302 HAT visible through top (green PCB with gold SMA connector)
- 5dBi 915MHz antenna (tall, 1.2 units, with articulating base joint)
- GPS antenna (small ceramic patch, 0.2 × 0.02 × 0.2, on top)
- USB-C power cable nub
- Status LED (accent-colored)

##### Hub model interaction

Same as sensor: drag-to-rotate, auto-rotation when idle, responsive resize. Same camera, lighting, and ground plane setup.

#### 3.2.5 Part Summary Data

The component fetches part data from the existing Drizzle schema to populate the text below each canvas. Data comes from:

- `hubTiers` + `hubTierParts` tables → hub name, price, part list
- `sensorTiers` + `sensorTierParts` tables → sensor name, price, part list

Create a new API route: **`src/pages/api/hardware-summary.ts`**

```typescript
// GET /api/hardware-summary?arch=zigbee&tier=premium
// Returns:
{
  sensor: {
    tierName: "Zigbee Premium Sensor",
    price: 82,         // USD
    parts: "ESP32-C6 · OV5640 5MP · LD2410C · 350mAh · TICONN 8.7″",
    accentColor: "#00e5a0"
  },
  hub: {
    tierName: "Zigbee Premium Hub",
    price: 225,
    parts: "Pi 5 8GB · SLZB-06 · 64GB microSD · Argon ONE V5 · 27W PSU",
    accentColor: "#00e5a0"
  } | null  // null for standalone
}
```

The component calls this endpoint on mount and on architecture/tier change (debounced 150ms).

#### 3.2.6 Accent Colors

Map from `src/lib/hardwareVisuals.ts`. Each architecture × tier combination has a unique accent:

| Architecture | Tier | Sensor Accent | Hub Accent |
|-------------|------|---------------|------------|
| Standalone | Budget | `#00e5a0` | N/A |
| Standalone | Premium | `#34d399` | N/A |
| Zigbee | Budget | `#38bdf8` | `#60a5fa` |
| Zigbee | Premium | `#818cf8` | `#a78bfa` |
| LoRaWAN | Budget | `#fbbf24` | `#f59e0b` |
| LoRaWAN | Premium | `#f97316` | `#fb923c` |

These colors pass through to the `accentColor` prop on both `Viewer3D` and `HubViewer3D`, controlling LED emissive color and other accent highlights.

### 3.3 Section Styling

Match the existing landing page dark aesthetic:

```css
/* Container */
#hardware-explorer {
  /* Same rounded card style as LandingSignalScene */
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: radial-gradient(
    circle at top,
    rgba(0, 229, 160, 0.08),
    transparent 38%
  ), linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.04),
    rgba(255, 255, 255, 0.01)
  );
  padding: 2.5rem;
}
```

Section header:
```html
<div class="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">Hardware</div>
<h2 class="mt-3 text-3xl font-semibold tracking-tight">
  Explore the hardware that SwimSentry deploys.
</h2>
<p class="mt-3 max-w-[62ch] text-sm leading-7 text-text-secondary">
  Select an architecture and tier to see the actual sensor and hub components in 3D.
  Drag to rotate. Pricing reflects current supplier costs.
</p>
```

### 3.4 Architecture & Tier Selectors

Pill-shaped toggle buttons using the same styling pattern as the configurator:

```html
<!-- Architecture selector -->
<div class="mt-8 flex flex-wrap gap-2">
  <button class="selector-pill" data-active={arch === 'standalone'}>
    Standalone (WiFi)
  </button>
  <button class="selector-pill" data-active={arch === 'zigbee'}>
    Zigbee
  </button>
  <button class="selector-pill" data-active={arch === 'lora'}>
    LoRaWAN
  </button>
</div>

<!-- Tier selector -->
<div class="mt-3 flex gap-2">
  <button class="selector-pill" data-active={tier === 'budget'}>
    Budget
  </button>
  <button class="selector-pill" data-active={tier === 'premium'}>
    Premium
  </button>
</div>
```

Active state: `bg-accent/12 border-accent/30 text-accent`
Inactive state: `bg-white/4 border-white/8 text-text-secondary hover:border-white/14`

### 3.5 Mobile Behavior

| Breakpoint | Layout |
|-----------|--------|
| ≥ 1024px | Two-column grid: sensor left, hub right |
| 768–1023px | Two-column grid, narrower canvases (320px height) |
| < 768px | Single column, sensor stacked above hub, 300px canvas height |

On mobile, the architecture selector wraps to two rows if needed. Tier selector always fits in one row.

---

## 4. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/index.astro` | Edit | Add `<HardwareExplorer>` section between hero and advisor |
| `src/components/HardwareExplorer.tsx` | **Create** | New Solid.js container with selectors and two 3D panels |
| `src/components/HubViewer3D.tsx` | **Create** | New Three.js hub model renderer (3 architecture variants × 2 tiers) |
| `src/components/Viewer3D.tsx` | Edit | Add optional `label`, `partSummary`, `price` props |
| `src/lib/threadpilledHomeEmbed.ts` | Edit | Add pill click navigation, transition animation, height bump |
| `src/components/LandingSignalScene.astro` | Edit | Update embed min-height, add loading skeleton, retry button |
| `src/pages/api/hardware-summary.ts` | **Create** | API route returning sensor + hub tier data for given arch/tier |
| `src/lib/hardwareVisuals.ts` | Edit | Add accent color lookup function for explorer (if not already exposed) |

### New files: 3
### Modified files: 5

---

## 5. Data Flow

```
User selects architecture + tier
        │
        ▼
HardwareExplorer (Solid.js)
        │
        ├──▶ GET /api/hardware-summary?arch=X&tier=Y
        │         └── Reads hubTiers, sensorTiers, parts from SQLite
        │         └── Returns { sensor: {...}, hub: {...} | null }
        │
        ├──▶ Viewer3D (sensor canvas)
        │         └── props.accentColor ← sensor accent from hardwareVisuals
        │         └── props.visible ← true
        │         └── Renders procedural sensor model
        │
        └──▶ HubViewer3D (hub canvas)
                  └── props.architecture ← 'standalone' | 'zigbee' | 'lora'
                  └── props.tier ← 'budget' | 'premium'
                  └── props.accentColor ← hub accent from hardwareVisuals
                  └── Renders architecture-specific hub model (or WiFi placeholder)
```

---

## 6. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Two simultaneous WebGL contexts | Share a single `THREE.WebGLRenderer` across both canvases using `renderer.setRenderTarget()` — OR accept two contexts since modern GPUs handle this fine at 380px height. Start with two separate contexts for simplicity. |
| Three.js bundle size | Already in `package.json` and tree-shaken by Vite. Dynamic `import('three')` in both viewers (already done in `Viewer3D.tsx`). |
| Initial load | `client:visible` on `<HardwareExplorer>` ensures Three.js only loads when section enters viewport. |
| API call on every selector change | Debounce 150ms. Response is <1KB JSON, served from local SQLite — sub-10ms. |
| Mobile GPU | Reduce pixel ratio to `Math.min(devicePixelRatio, 1.5)` on screens < 768px. Reduce canvas height to 300px. |

---

## 7. Accessibility

- Both 3D canvases have `role="img"` and `aria-label` describing the rendered hardware
- Architecture/tier selectors use `role="radiogroup"` and `role="radio"` with `aria-checked`
- Part summary text below each canvas provides a text alternative to the 3D visual
- `prefers-reduced-motion: reduce` disables auto-rotation on both canvases
- Keyboard: Tab focuses selectors, Enter/Space toggles, Tab moves to canvases (rotation via arrow keys is optional/not required)

---

## 8. Non-Goals

- No GLTF/OBJ model loading — all geometry is procedural Three.js primitives (matches existing `Viewer3D.tsx` approach)
- No orbit controls library (e.g., `OrbitControls`) — keep the simple drag-to-rotate handler already in `Viewer3D.tsx`
- No physics or animation beyond auto-rotation
- No exploded view or part highlighting (future enhancement)
- No AR/WebXR mode
- Hub 3D models are simplified representations, not CAD-accurate — they should be recognizable, not photorealistic
