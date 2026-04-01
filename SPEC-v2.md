# PoolGuard v2 — Enhancement Specification

## Overview

This spec covers 11 enhancement items for the PoolGuard hardware configurator, building on the Astro 6 + SolidJS + TanStack Table + SQLite foundation established in v1. Changes span UX improvements, new pages, AI integration, and expanded persistence.

---

## 1. Obscure Default Port

**Goal:** Replace the default Astro dev port (`4321`) with a non-obvious port to avoid collisions and keep the local URL off common scanning lists.

### Changes

- **`astro.config.mjs`** — add `server: { port: 5187 }` to the config object
- **`scripts/run.ts`** — update the dev server banner to display the correct port
- Production preview (`astro preview`) should also use the same port for consistency

### Config diff

```js
// astro.config.mjs
export default defineConfig({
  server: { port: 5187 },
  // ... rest unchanged
});
```

---

## 2. Reusable Styled Dropdown Components

**Goal:** Replace the native `<select>` dropdowns (architecture filter, tier filter on the Summary/Pricing page) with custom-styled dropdown components that match the app's dark theme.

### Current Problem

Native `<select>` elements render with OS-default chrome (white background on macOS), breaking the dark UI. The dropdown options are unreadable against the page.

### Component: `Dropdown.tsx`

```
src/components/Dropdown.tsx
```

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `options` | `{ value: string; label: string }[]` | Menu items |
| `value` | `string \| null` | Current selection |
| `onChange` | `(value: string \| null) => void` | Selection callback |
| `placeholder` | `string` | Display text when nothing selected |
| `class` | `string?` | Additional CSS classes |

**Behavior:**

- Click trigger → open floating menu below (or above if near viewport bottom)
- Click outside or press `Escape` → close
- Keyboard: `ArrowDown`/`ArrowUp` to navigate, `Enter` to select, `Escape` to close
- Selected option shows a subtle checkmark icon on the right
- Trigger displays the selected label or placeholder with a chevron-down icon
- Menu items highlight on hover with `bg-bg-card-hover`
- Active/selected item has left accent border

**Styling:**

- Trigger: `bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm`
- Menu: `bg-bg-card border border-border rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)]` with `z-50`
- Items: `px-3 py-2 text-sm text-text-primary hover:bg-bg-card-hover cursor-pointer`
- Chevron icon: `w-4 h-4 text-text-tertiary` rotates 180° when open

**Integration:**

- Replace both `<select>` elements in `SummaryTable.tsx` with `<Dropdown />`
- Reuse in any future filter/selection UI (Build page, Personas page)

---

## 3. Pretty URL Table in Run Script

**Goal:** After the dev server starts, print a formatted table in the terminal showing all available routes/URLs.

### Output Format

```
┌─────────────────────────────────────────────────────────┐
│  PoolGuard v2                      http://localhost:5187 │
├───────────────┬─────────────────────────────────────────┤
│  Pricing      │  http://localhost:5187/                  │
│  Build        │  http://localhost:5187/build             │
│  Personas     │  http://localhost:5187/personas          │
│  API: Configs │  http://localhost:5187/api/configs       │
├───────────────┴─────────────────────────────────────────┤
│  Press Ctrl+C to stop                                    │
└─────────────────────────────────────────────────────────┘
```

### Implementation

- Add a `printRouteTable(port: number)` function to `scripts/run.ts`
- Uses ANSI box-drawing characters (`┌ ─ ┬ ┤ └ ┘ │ ├ ┴ ┐`)
- Route list derived from a `ROUTES` constant array so it stays in sync as pages are added
- Called after `ensureDeps()` and `ensureDb()` but before `$\`npx astro dev\``
- Colors: route names in CYAN, URLs in GREEN, border in DIM

---

## 4. Table Column Toggles, Resize & Search

**Goal:** Enhance the TanStack Table on the Pricing page with column visibility toggles, resizable columns, and a global search filter.

### Sub-features

#### 4a. Column Visibility Toggles

- Add a "Columns" button next to the filter dropdowns
- Clicking opens a popover with checkboxes for each column
- State stored in a `createSignal<VisibilityState>({})` passed to TanStack's `columnVisibility`
- All columns visible by default; user can hide any except "Architecture" (always visible)
- Persist visibility preferences to `localStorage` (key: `poolguard-col-visibility`)

#### 4b. Column Resizing

- Enable TanStack's `getResizableColumnModel()` and `columnResizeMode: 'onChange'`
- Render a drag handle (`<div>`) on each column header's right edge
- Handle styles: `w-1 h-full bg-border hover:bg-accent cursor-col-resize absolute right-0 top-0`
- Min column width: `60px`; default sizes set per column in `ColumnDef.size`

#### 4c. Global Search

- Add a search `<input>` (styled like the existing Dropdown trigger) to the filter bar
- Debounce input by 200ms
- Filter rows client-side by checking if any visible cell's text content includes the search term (case-insensitive)
- Uses TanStack's `getFilteredRowModel()` with a custom `globalFilterFn`
- Search icon (Lucide `Search`) inside the input as a prefix

### Filter Bar Layout

```
[ 🔍 Search builds...  ] [ Architecture ▾ ] [ Tier ▾ ] [ ⚙ Columns ] │ 8 of 10
```

---

## 5. Lucide Checkmark for Completed Build Steps

**Goal:** Replace the small green dot indicator for completed wizard steps with a Lucide `Check` icon, positioned on the left side of the step label.

### Current State

Completed steps show a `<span class="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full" />` — a tiny green dot in the top-right corner.

### Target State

- Install `lucide-solid` (Lucide icons for SolidJS)
- For completed steps (`tab.num < step()`), render `<Check size={14} class="text-accent" />` to the left of the step number
- Remove the absolute-positioned dot
- Step layout becomes: `[✓ 01  Hub type]` for completed, `[02  Hub tier]` for active/future

### Implementation in `Configurator.tsx`

```tsx
import { Check } from 'lucide-solid';

// Inside the step tab rendering:
<div class="flex items-center justify-center gap-1.5">
  <Show when={tab.num < step()}>
    <Check size={14} class="text-accent" />
  </Show>
  <span class="font-mono text-[11px]">
    {String(tab.num).padStart(2, '0')}
  </span>
</div>
{tab.label}
```

### Dependency

```bash
sfw npm install lucide-solid@0.469.0
```

---

## 6. Rename "Summary" Page → "Pricing"

**Goal:** Rename the current Summary page to "Pricing" since it primarily displays a pricing comparison matrix.

### Changes

| File | Change |
|------|--------|
| `src/components/Nav.astro` | Change link text from `Summary` to `Pricing` |
| `src/pages/index.astro` | Update `<title>` and page heading text |
| `src/components/SummaryTable.tsx` | No file rename needed (internal component name stays) |
| `src/components/Footer.astro` | Update any references |
| `SPEC.md` | Update terminology |

The route stays at `/` (no URL change needed).

---

## 7. New Granular "Build" Page

**Goal:** Create a more granular Build page that allows users to pick individual components (parts) rather than just selecting from pre-defined tiers.

### Route

```
/build/custom → src/pages/build/custom.astro
```

Keep the existing `/build` as the "Quick Build" (tier-based wizard). Add a link from Quick Build to Custom Build and vice versa.

### Page Structure

```
┌──────────────────────────────────────────────────┐
│  Custom Build                                     │
│  Pick individual components for a bespoke setup   │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─ Hub ──────────────────────────────────────┐   │
│  │  Architecture: [ Zigbee ▾ ]                │   │
│  │                                            │   │
│  │  ☑ Raspberry Pi 4B 8GB      $55            │   │
│  │  ☑ Zigbee2MQTT USB Dongle   $25            │   │
│  │  ☑ 32GB SD Card             $8             │   │
│  │  ☐ PoE HAT (optional)       $20            │   │
│  │  ☐ Custom Enclosure         $15            │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌─ Sensor ───────────────────────────────────┐   │
│  │  ☑ ESP32-CAM Module         $6             │   │
│  │  ☑ 24GHz mmWave Radar       $8             │   │
│  │  ☑ 18650 LiPo Battery       $4             │   │
│  │  ☐ Solar Panel 5V/1W        $12            │   │
│  │  ☑ IP67 Enclosure           $5             │   │
│  │  ...                                       │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌─ Running total ─────────────────────────────┐  │
│  │  Hub: $88 │ Sensor: $23 × 4 = $92          │  │
│  │  Grand total: $180                          │  │
│  │  [ Save custom build ]                      │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Component: `CustomBuilder.tsx`

**State:**

```ts
const [arch, setArch] = createSignal<string | null>(null);
const [selectedHubParts, setSelectedHubParts] = createSignal<Set<number>>(new Set());
const [selectedSensorParts, setSelectedSensorParts] = createSignal<Set<number>>(new Set());
const [qty, setQty] = createSignal(4);
```

**Behavior:**

- Selecting an architecture loads all hub parts and sensor parts for that arch from the catalog
- Parts shown as checkbox list with name, description, and price
- Some parts marked as "required" (core to the tier) — pre-checked and cannot be unchecked
- Running total updates reactively
- "Save custom build" POSTs to a new `/api/custom-builds` endpoint

### Schema Addition

```ts
export const customBuilds = sqliteTable('custom_builds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  sensorQty: integer('sensor_qty').notNull().default(4),
  totalPrice: integer('total_price').notNull(), // cents
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const customBuildParts = sqliteTable('custom_build_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customBuildId: integer('custom_build_id').notNull().references(() => customBuilds.id),
  partType: text('part_type').notNull(), // 'hub' | 'sensor'
  partName: text('part_name').notNull(),
  partDescription: text('part_description').notNull(),
  price: integer('price').notNull(), // cents
  sortOrder: integer('sort_order').notNull(),
});
```

### Nav Update

```
[ Pricing ] [ Quick Build ] [ Custom Build ] [ Personas ]
```

---

## 8. AI-Powered BOM Link Generation

**Goal:** For each part in the BOM, dynamically fetch purchase links from suppliers (Amazon, Adafruit, Digikey, AliExpress) using an AI model to find current product listings.

### Architecture

```
User clicks "Find links" on a BOM part
  → POST /api/bom-links
  → Server calls Claude API with part name + specs
  → Claude returns structured JSON with supplier links
  → Links cached in SQLite, served on subsequent requests
```

### API Route: `/api/bom-links`

```
POST /api/bom-links
Body: { partName: string, partDescription: string, targetPrice: number }
Response: {
  links: [
    { supplier: "Amazon", url: string, price: string, confidence: "high" | "medium" | "low" },
    { supplier: "AliExpress", url: string, price: string, confidence: "high" | "medium" | "low" },
    ...
  ],
  cached: boolean
}
```

### Schema Addition

```ts
export const bomLinks = sqliteTable('bom_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partName: text('part_name').notNull(),
  supplier: text('supplier').notNull(),
  url: text('url').notNull(),
  price: text('price'),
  confidence: text('confidence').notNull(), // 'high' | 'medium' | 'low'
  fetchedAt: text('fetched_at').notNull(),
});
```

### UI Component: `BomLinks.tsx`

- Inline expandable under each part row in the BOM
- "Find links" button triggers the API call with a loading spinner
- Results show supplier icon, name, price, and external link
- "Refresh" button to re-fetch (ignores cache)
- Low-confidence links shown with a warning indicator
- Links open in new tab with `rel="noopener noreferrer"`

### Configuration

- Claude API key stored in `.env` as `ANTHROPIC_API_KEY`
- Add `.env` to `.gitignore`
- Use `@anthropic-ai/sdk` for structured API calls
- System prompt instructs Claude to return JSON with purchase URLs for the given electronic component
- Rate limit: max 5 concurrent requests, 30 requests per minute

### Dependency

```bash
sfw npm install @anthropic-ai/sdk@0.39.0
```

---

## 9. AI Chat Sidebar

**Goal:** Add a collapsible sidebar where users can describe their pool security needs in natural language, and the AI recommends a configuration.

### Layout

```
┌────────────────────────────────────────────┬──────────────┐
│                                            │  AI Advisor  │
│         Main content area                  │              │
│         (unchanged)                        │  "I have a   │
│                                            │  large pool  │
│                                            │  and want    │
│                                            │  coverage    │
│                                            │  for..."     │
│                                            │              │
│                                            │  💬 ────────│
│                                            │  [Send]      │
└────────────────────────────────────────────┴──────────────┘
```

### Component: `ChatSidebar.tsx`

**State:**

```ts
const [open, setOpen] = createSignal(false);
const [messages, setMessages] = createSignal<ChatMessage[]>([]);
const [input, setInput] = createSignal('');
const [loading, setLoading] = createSignal(false);
```

**Type:**

```ts
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendation?: {
    hubTypeId: string;
    hubTierId?: string;
    sensorTierId: string;
    qty: number;
    reasoning: string;
  };
}
```

**Behavior:**

- Toggle button fixed to right edge of viewport: vertical text "AI Advisor" with Lucide `MessageSquare` icon
- Sidebar slides in from right, width `380px`, with backdrop blur overlay on mobile
- Chat messages rendered in a scrollable container
- When the AI returns a recommendation, render it as a special card with:
  - Recommended build summary (hub type, tier, sensor tier, qty)
  - "Apply this build" button → navigates to `/build?hub_type=...&sensor_tier=...`
  - Reasoning text explaining why this config fits
- Markdown support in assistant messages via a simple renderer (bold, links, lists)

### API Route: `/api/chat`

```
POST /api/chat
Body: { messages: { role: string, content: string }[] }
Response: {
  content: string,
  recommendation?: { hubTypeId, hubTierId?, sensorTierId, qty, reasoning }
}
```

**System prompt** includes:
- Full catalog data (hub types, tiers, sensor tiers, prices)
- Instruction to recommend builds based on user description
- JSON schema for the recommendation object
- Guidelines for pool security (coverage calculations, budget tiers, use cases)

### Styling

- Sidebar: `bg-bg-surface border-l border-border`
- Messages: user messages `bg-bg-elevated rounded-lg p-3`, assistant messages plain
- Input: `bg-bg-card border border-border rounded-lg` at bottom of sidebar
- Recommendation card: `bg-bg-card border border-accent/30 rounded-xl p-4`

### Dependency

Shares `@anthropic-ai/sdk` installed in item 8.

---

## 10. SQLite Tracking for Builds, Bundles & Preselections

**Goal:** Expand the database to track user activity — build sessions, bundle preselections from the Pricing page, and custom build history — so users can reference past configurations.

### New Tables

```ts
// Track each time a user starts/completes the build wizard
export const buildSessions = sqliteTable('build_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTypeId: text('hub_type_id').references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').references(() => sensorTiers.id),
  qty: integer('qty'),
  status: text('status').notNull(), // 'started' | 'step2' | 'step3' | 'completed' | 'saved'
  source: text('source').notNull(), // 'wizard' | 'pricing-link' | 'chat-recommendation' | 'persona'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Track bundle preselections (when user clicks "Build this" from Pricing table)
export const preselections = sqliteTable('preselections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  source: text('source').notNull(), // 'pricing-table' | 'persona' | 'ai-chat'
  convertedToSave: integer('converted_to_save').notNull().default(0), // boolean
  createdAt: text('created_at').notNull(),
});

// Track AI chat sessions
export const chatSessions = sqliteTable('chat_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageCount: integer('message_count').notNull().default(0),
  recommendationMade: integer('recommendation_made').notNull().default(0), // boolean
  recommendationApplied: integer('recommendation_applied').notNull().default(0), // boolean
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/sessions` | Create a build session (on wizard start) |
| PUT | `/api/sessions/:id` | Update session status as user progresses |
| GET | `/api/sessions` | List recent sessions with pagination |
| POST | `/api/preselections` | Log a preselection event |
| GET | `/api/preselections` | List preselections with conversion rate |

### Tracking Integration Points

| Event | Where | What gets recorded |
|-------|-------|--------------------|
| User clicks "Build this →" on Pricing table | `SummaryTable.tsx` | New `preselection` row with `source: 'pricing-table'` |
| User starts wizard | `Configurator.tsx` Step 1 | New `buildSession` with `status: 'started'` |
| User advances step | `Configurator.tsx` Step 2/3/4 | Update session `status` |
| User saves config | `Configurator.tsx` save flow | Update session `status: 'saved'` |
| AI recommends build | `ChatSidebar.tsx` | Update `chatSession.recommendationMade` |
| User applies AI recommendation | `ChatSidebar.tsx` → navigate | New `preselection` with `source: 'ai-chat'`, update `chatSession.recommendationApplied` |

---

## 11. Personas Page

**Goal:** Add a "Personas" page that maps predefined user personas to recommended bundles, helping users identify the best configuration for their specific situation.

### Route

```
/personas → src/pages/personas.astro
```

### Personas Data Model

```ts
export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(), // e.g. 'family-suburban', 'airbnb-host'
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(), // Lucide icon name
  sortOrder: integer('sort_order').notNull(),
});

export const personaFactors = sqliteTable('persona_factors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: text('persona_id').notNull().references(() => personas.id),
  factor: text('factor').notNull(),    // e.g. 'distance_to_pool'
  label: text('label').notNull(),      // e.g. 'Distance from house to pool'
  value: text('value').notNull(),      // e.g. '15-30 ft'
  importance: text('importance').notNull(), // 'critical' | 'high' | 'medium' | 'low'
  sortOrder: integer('sort_order').notNull(),
});

export const personaBundles = sqliteTable('persona_bundles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: text('persona_id').notNull().references(() => personas.id),
  label: text('label').notNull(),       // e.g. 'Recommended', 'Budget Alternative'
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  qty: integer('qty').notNull(),
  reasoning: text('reasoning').notNull(), // Why this bundle fits
  sortOrder: integer('sort_order').notNull(),
});
```

### Seed Data — Persona Definitions

| ID | Name | Tagline | Key Factors |
|----|------|---------|-------------|
| `family-suburban` | Family Home | "Kids, pets, peace of mind" | Distance: 20-50ft, Budget: medium, Kids: 2+, Response time: <30s, Notifications: phone + smart speaker |
| `airbnb-host` | Vacation Rental | "Protect guests, protect liability" | Distance: varies (remote), Budget: low-medium, Kids: unknown guests, Response time: <60s, Notifications: phone + email + guest display |
| `estate-luxury` | Luxury Estate | "Full coverage, no compromises" | Distance: 50-200ft, Budget: high, Kids: optional, Response time: <10s, Notifications: phone + security panel + intercom |
| `community-pool` | Community / HOA | "Multi-zone, multi-user" | Distance: N/A (on-site), Budget: high (shared), Zones: 3+, Response time: <15s, Notifications: staff radio + PA + dashboard |
| `rural-homestead` | Rural Property | "Long range, solar powered" | Distance: 100-500ft, Budget: medium, Power: solar required, Response time: <120s, Notifications: phone + alarm |
| `budget-conscious` | Budget Setup | "Maximum safety, minimum spend" | Distance: <30ft, Budget: strict low, Kids: any, Response time: <60s, Notifications: phone only |

### Component: `PersonaGrid.tsx`

**Layout:**

```
┌──────────────────────────────────────────────────────────────┐
│  Find your fit                                                │
│  Select a persona to see recommended configurations           │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │ 🏠          │  │ 🏖️          │  │ 🏛️          │           │
│  │ Family Home │  │ Vacation    │  │ Luxury      │           │
│  │ Kids, pets, │  │ Rental      │  │ Estate      │           │
│  │ peace of    │  │             │  │             │           │
│  │ mind        │  │             │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                │
│  ┌─ Selected: Family Home ────────────────────────────────┐   │
│  │                                                        │   │
│  │  Considerations                                        │   │
│  │  ├─ 🔴 Distance: 20-50ft (critical)                   │   │
│  │  ├─ 🟡 Budget: $200-400 (high)                        │   │
│  │  ├─ 🟡 Response time: <30s (high)                     │   │
│  │  ├─ 🟢 Kids: 2+ (medium)                              │   │
│  │  └─ 🟢 Notifications: phone + smart speaker (medium)  │   │
│  │                                                        │   │
│  │  Recommended Bundles                                   │   │
│  │  ┌─ ⭐ Recommended ──────────────────────────────┐     │   │
│  │  │  Zigbee Budget Hub + Budget Sensors × 4       │     │   │
│  │  │  Total: $220 │ Coverage: ~216 m²              │     │   │
│  │  │  "Best balance of coverage and cost for a     │     │   │
│  │  │   typical backyard pool"                       │     │   │
│  │  │  [ Build this → ]                              │     │   │
│  │  └────────────────────────────────────────────────┘     │   │
│  │  ┌─ Budget Alternative ───────────────────────────┐     │   │
│  │  │  Standalone Budget Sensors × 3                 │     │   │
│  │  │  Total: $84 │ Coverage: ~65 m²                 │     │   │
│  │  │  [ Build this → ]                              │     │   │
│  │  └────────────────────────────────────────────────┘     │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**State:**

```ts
const [selectedPersona, setSelectedPersona] = createSignal<string | null>(null);
```

**Behavior:**

- Grid of persona cards (3 columns desktop, 1 column mobile)
- Clicking a persona card expands the detail panel below with animation
- Detail panel shows:
  1. **Factors/Considerations** — list with importance-based color coding (critical=red, high=amber, medium=green, low=dim)
  2. **Recommended bundles** — 1-2 pre-matched configurations with pricing, coverage calc, and reasoning
  3. "Build this →" links pre-populate the `/build` wizard via query params
- "Build this →" click also creates a `preselection` record with `source: 'persona'`

### Nav Update (Final)

```
[ Pricing ] [ Quick Build ] [ Custom Build ] [ Personas ]
```

---

## Implementation Order

Recommended phased approach to minimize conflicts:

### Phase 1 — Quick wins (items 1, 5, 6)
- Obscure port
- Lucide checkmark icons
- Rename Summary → Pricing
- No new deps beyond `lucide-solid`

### Phase 2 — Table enhancements (items 2, 3, 4)
- Custom Dropdown component
- Run script URL table
- Column toggles, resize, search

### Phase 3 — Granular build (item 7)
- Custom Build page
- New schema tables + migration
- `CustomBuilder.tsx` component

### Phase 4 — AI features (items 8, 9)
- BOM link generation API
- Chat sidebar component
- `@anthropic-ai/sdk` dependency
- `.env` setup

### Phase 5 — Tracking & Personas (items 10, 11)
- Session/preselection tracking tables + migration
- Personas schema, seed data, page
- `PersonaGrid.tsx` component
- Tracking integration across all pages

---

## New Dependencies Summary

| Package | Version | Item |
|---------|---------|------|
| `lucide-solid` | 0.469.x | 5 (checkmarks), 9 (chat icon), 11 (persona icons) |
| `@anthropic-ai/sdk` | 0.39.x | 8 (BOM links), 9 (chat) |

All installs via `sfw npm install <package>@<version>`.

---

## New Files Summary

| File | Item | Description |
|------|------|-------------|
| `src/components/Dropdown.tsx` | 2 | Reusable styled dropdown |
| `src/components/CustomBuilder.tsx` | 7 | Granular part picker |
| `src/components/BomLinks.tsx` | 8 | Purchase link cards |
| `src/components/ChatSidebar.tsx` | 9 | AI advisor sidebar |
| `src/components/PersonaGrid.tsx` | 11 | Persona cards + detail |
| `src/pages/build/custom.astro` | 7 | Custom build page |
| `src/pages/personas.astro` | 11 | Personas page |
| `src/pages/api/bom-links.ts` | 8 | AI link generation endpoint |
| `src/pages/api/chat.ts` | 9 | AI chat endpoint |
| `src/pages/api/sessions.ts` | 10 | Build session tracking |
| `src/pages/api/sessions/[id].ts` | 10 | Session update endpoint |
| `src/pages/api/preselections.ts` | 10 | Preselection tracking |
| `src/pages/api/custom-builds.ts` | 7 | Custom build CRUD |
| `.env` | 8, 9 | `ANTHROPIC_API_KEY` |

---

## Modified Files Summary

| File | Items | Changes |
|------|-------|---------|
| `astro.config.mjs` | 1 | Add `server.port: 5187` |
| `scripts/run.ts` | 1, 3 | Port update, route table printer |
| `src/components/Nav.astro` | 6, 7, 11 | Rename tab, add new tabs |
| `src/components/SummaryTable.tsx` | 2, 4, 10 | Dropdown, column features, tracking |
| `src/components/Configurator.tsx` | 5, 10 | Lucide icons, session tracking |
| `src/lib/schema.ts` | 7, 8, 10, 11 | New tables |
| `src/lib/data.ts` | 7, 11 | New types |
| `scripts/seed.ts` | 11 | Persona seed data |
| `src/layouts/Base.astro` | 9 | ChatSidebar slot |
| `src/styles/global.css` | 2, 9 | Dropdown + sidebar animations |
| `package.json` | 5, 8 | New deps |
| `.gitignore` | 8 | Add `.env` |
