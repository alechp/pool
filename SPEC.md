# Pool Security — Hardware Configurator: Enhancement Spec

## Overview

Migrate the single-file `index.html` configurator into a multi-page Astro application with two routes, SolidJS interactive islands, TanStack Table for the summary matrix, Tailwind CSS v4 for styling, and SQLite persistence via better-sqlite3 + Drizzle ORM.

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| `astro` | 5.x | Framework, file-based routing, SSR |
| `@astrojs/solid-js` | 6.x | SolidJS island integration |
| `solid-js` | 1.9.x | Reactive UI components |
| `@tanstack/solid-table` | 8.x | Headless data table (Summary page) |
| `tailwindcss` | 4.x | Utility CSS |
| `@tailwindcss/vite` | 4.x | Vite plugin (replaces deprecated `@astrojs/tailwind`) |
| `@astrojs/node` | 10.x | Node SSR adapter for API routes |
| `better-sqlite3` | latest | Synchronous SQLite driver |
| `drizzle-orm` | latest | Type-safe ORM |
| `drizzle-kit` | latest (dev) | Migration tooling |
| `@types/better-sqlite3` | latest (dev) | TypeScript types |
| `three` | 0.128.x | 3D sensor preview (Build page only) |

**Runtime requirement:** Node.js >= 22.12.0 (required by `@astrojs/solid-js` v6).

---

## Project Structure

```
pool/
├── astro.config.mjs
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── sqlite.db                          # Created at first run
├── drizzle/                           # Generated migrations
│   └── 0000_init.sql
├── public/
│   └── favicon.svg
├── src/
│   ├── styles/
│   │   └── global.css                 # Tailwind v4 + custom theme
│   ├── lib/
│   │   ├── db.ts                      # better-sqlite3 + Drizzle instance
│   │   ├── schema.ts                  # Drizzle table definitions
│   │   ├── seed.ts                    # Seed script for catalog data
│   │   └── data.ts                    # TypeScript types + static catalog
│   ├── components/
│   │   ├── Header.astro               # Shared sticky header
│   │   ├── Footer.astro               # Shared footer
│   │   ├── Nav.astro                  # Page-level nav (Summary | Build)
│   │   ├── SummaryTable.tsx           # SolidJS — TanStack Table island
│   │   ├── Configurator.tsx           # SolidJS — 4-step build wizard
│   │   ├── Viewer3D.tsx               # SolidJS — Three.js 3D preview
│   │   ├── FleetSizer.tsx             # SolidJS — qty slider + metrics
│   │   └── OptionCard.tsx             # SolidJS — reusable selection card
│   ├── layouts/
│   │   └── Base.astro                 # HTML shell, global CSS, meta
│   └── pages/
│       ├── index.astro                # Summary page (matrix table)
│       ├── build.astro                # Build page (configurator wizard)
│       └── api/
│           ├── configs.ts             # GET list / POST save / DELETE
│           └── configs/[id].ts        # GET one / PUT update
└── scripts/
    └── seed.ts                        # `tsx scripts/seed.ts` — populate catalog
```

---

## Astro Configuration

### `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- `output: 'server'` — all pages server-rendered so API routes and DB reads work without per-route opt-in.
- `adapter: node({ mode: 'standalone' })` — Astro runs its own HTTP server, serves static assets from `dist/client/`.

### `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

### `drizzle.config.ts`

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  dialect: 'sqlite',
  dbCredentials: { url: './sqlite.db' },
  out: './drizzle',
} satisfies Config;
```

---

## Database Schema

### Tables

#### `hub_types` — catalog of communication architectures

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | `'none'`, `'zigbee'`, `'lorawan'` |
| `name` | TEXT NOT NULL | Display name |
| `badge` | TEXT NOT NULL | Badge label |
| `badge_class` | TEXT NOT NULL | CSS class for badge color |
| `description` | TEXT NOT NULL | Long description |
| `specs` | TEXT NOT NULL | JSON array of spec strings |

#### `hub_tiers` — hub hardware options per type

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | `'zigbee-cheap'`, `'zigbee-premium'`, `'lora-cheap'`, `'lora-premium'` |
| `hub_type_id` | TEXT FK → hub_types.id | Parent architecture |
| `name` | TEXT NOT NULL | Display name |
| `badge` | TEXT NOT NULL | `'Budget'` or `'Premium'` |
| `badge_class` | TEXT NOT NULL | CSS class |
| `description` | TEXT NOT NULL | Long description |
| `price` | INTEGER NOT NULL | Price in USD cents (2800 = $28.00) |
| `specs` | TEXT NOT NULL | JSON array of spec strings |

#### `hub_tier_parts` — BOM line items for each hub tier

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `hub_tier_id` | TEXT FK → hub_tiers.id | Parent tier |
| `name` | TEXT NOT NULL | Part name |
| `description` | TEXT NOT NULL | Part description |
| `price` | INTEGER NOT NULL | Price in USD cents |
| `sort_order` | INTEGER NOT NULL | Display order |

#### `sensor_tiers` — sensor hardware options per hub type

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | `'sa-cheap'`, `'sa-premium'`, `'zb-cheap'`, etc. |
| `hub_type_id` | TEXT FK → hub_types.id | Compatible architecture |
| `name` | TEXT NOT NULL | Display name |
| `badge` | TEXT NOT NULL | `'Budget'` or `'Premium'` |
| `badge_class` | TEXT NOT NULL | CSS class |
| `description` | TEXT NOT NULL | Long description |
| `price` | INTEGER NOT NULL | Per-unit price in USD cents |
| `battery` | TEXT NOT NULL | Battery life string |
| `comm_range` | TEXT NOT NULL | Communication range string |
| `accent_color` | TEXT NOT NULL | Hex color for 3D viewer (e.g. `'#00e5a0'`) |
| `specs` | TEXT NOT NULL | JSON array of spec strings |

#### `sensor_tier_parts` — BOM line items for each sensor tier

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `sensor_tier_id` | TEXT FK → sensor_tiers.id | Parent tier |
| `name` | TEXT NOT NULL | Part name |
| `description` | TEXT NOT NULL | Part description |
| `price` | INTEGER NOT NULL | Price in USD cents |
| `sort_order` | INTEGER NOT NULL | Display order |

#### `saved_configs` — user-saved build configurations

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | User-given name (default: auto-generated) |
| `hub_type_id` | TEXT FK → hub_types.id | Selected architecture |
| `hub_tier_id` | TEXT FK → hub_tiers.id, NULLABLE | NULL when hub_type is `'none'` |
| `sensor_tier_id` | TEXT FK → sensor_tiers.id | Selected sensor |
| `qty` | INTEGER NOT NULL DEFAULT 4 | Sensor count (1–8) |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT NOT NULL | ISO 8601 timestamp |

### Drizzle Schema (`src/lib/schema.ts`)

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const hubTypes = sqliteTable('hub_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  specs: text('specs').notNull(), // JSON
});

export const hubTiers = sqliteTable('hub_tiers', {
  id: text('id').primaryKey(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  specs: text('specs').notNull(),
});

export const hubTierParts = sqliteTable('hub_tier_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTierId: text('hub_tier_id').notNull().references(() => hubTiers.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const sensorTiers = sqliteTable('sensor_tiers', {
  id: text('id').primaryKey(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  battery: text('battery').notNull(),
  commRange: text('comm_range').notNull(),
  accentColor: text('accent_color').notNull(),
  specs: text('specs').notNull(),
});

export const sensorTierParts = sqliteTable('sensor_tier_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const savedConfigs = sqliteTable('saved_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  qty: integer('qty').notNull().default(4),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### Seed Data

The seed script (`scripts/seed.ts`) populates `hub_types`, `hub_tiers`, `hub_tier_parts`, `sensor_tiers`, and `sensor_tier_parts` from the existing `index.html` data. All prices are stored in **USD cents** (multiply existing dollar values by 100). The `saved_configs` table starts empty.

---

## Pages & Routing

### Layout: `src/layouts/Base.astro`

Shared HTML shell used by both pages:

- `<html lang="en">` with dark background
- `<head>`: charset, viewport, title, Google Fonts (DM Mono + Outfit), `global.css` import
- `<body>`:
  - `<Header />` — sticky header with logo, live-dot, nav tabs
  - `<Nav />` — two tabs: **Summary** (`/`) and **Build** (`/build`), active state from `Astro.url.pathname`
  - `<slot />` — page content
  - `<Footer />`

### Page 1: Summary (`src/pages/index.astro`) — `/`

**Purpose:** Show every possible build configuration in a single comparison matrix. Users can scan all options, compare costs, and jump to the Build page with a pre-selected config.

**Server-side data loading:**

```astro
---
import Base from '../layouts/Base.astro';
import SummaryTable from '../components/SummaryTable.tsx';
import { db } from '../lib/db';
import { hubTypes, hubTiers, hubTierParts, sensorTiers, sensorTierParts, savedConfigs } from '../lib/schema';

// Load full catalog from SQLite
const allHubTypes = db.select().from(hubTypes).all();
const allHubTiers = db.select().from(hubTiers).all();
const allSensorTiers = db.select().from(sensorTiers).all();
const allHubParts = db.select().from(hubTierParts).all();
const allSensorParts = db.select().from(sensorTierParts).all();
const allSavedConfigs = db.select().from(savedConfigs).all();

// Assemble into nested structure for the table component
// (see Data Assembly below)
---
<Base title="Pool Security — Summary">
  <SummaryTable
    client:load
    catalog={catalog}
    savedConfigs={allSavedConfigs}
  />
</Base>
```

**SummaryTable component (`SummaryTable.tsx`):**

A SolidJS island using `@tanstack/solid-table`. Renders a matrix of all valid build combinations.

**Matrix rows** — one row per valid `(hubType, hubTier | null, sensorTier)` combination. There are **10 valid combinations** total:

| # | Hub Type | Hub Tier | Sensor Tier | Hub Cost | Sensor Cost | Total (×4) |
|---|---|---|---|---|---|---|
| 1 | None | — | Standalone budget | $0 | $64 | $256 |
| 2 | None | — | Standalone premium | $0 | $82 | $328 |
| 3 | Zigbee | Budget ($28) | Zigbee budget | $28 | $54 | $244 |
| 4 | Zigbee | Budget ($28) | Zigbee premium | $28 | $82 | $356 |
| 5 | Zigbee | Premium ($225) | Zigbee budget | $225 | $54 | $441 |
| 6 | Zigbee | Premium ($225) | Zigbee premium | $225 | $82 | $553 |
| 7 | LoRaWAN | Budget ($115) | LoRa budget | $115 | $68 | $387 |
| 8 | LoRaWAN | Budget ($115) | LoRa premium | $115 | $95 | $495 |
| 9 | LoRaWAN | Premium ($265) | LoRa budget | $265 | $68 | $537 |
| 10 | LoRaWAN | Premium ($265) | LoRa premium | $265 | $95 | $645 |

**Table columns:**

| Column | Key | Description |
|---|---|---|
| Architecture | `hubType` | Hub type badge (None / Zigbee / LoRaWAN) |
| Hub | `hubTier` | Hub tier name + badge, or "—" for standalone |
| Hub Cost | `hubCost` | Formatted price, $0 shown as "—" |
| Sensor | `sensorTier` | Sensor tier name + badge |
| Sensor Cost | `sensorCost` | Per-unit price |
| Battery | `battery` | Battery life string |
| Range | `commRange` | Communication range |
| Total (×4) | `totalCost` | Hub + 4× sensor, computed |
| Parts | `partCount` | Total BOM line items (hub parts + sensor parts) |
| Action | — | "Build this" link → `/build?hub_type=X&hub_tier=Y&sensor_tier=Z` |

**Table features:**

- **Sorting** — click any column header to sort. Default: sort by `totalCost` ascending (cheapest first).
- **Filtering** — row of filter dropdowns above the table:
  - Architecture: All / None / Zigbee / LoRaWAN
  - Tier: All / Budget / Premium
- **Row grouping** — rows visually grouped by hub type with a colored left border matching badge color.
- **Expandable rows** — click a row to expand and show the full BOM parts list inline (hub parts + sensor parts in two sub-tables).
- **Saved configs section** — below the matrix, a separate smaller table showing saved configurations from `saved_configs`. Each row shows the config name, selections, qty, total cost, and actions (Load into Build / Delete).

### Page 2: Build (`src/pages/build.astro`) — `/build`

**Purpose:** The interactive 4-step configurator wizard. This is the current `index.html` functionality, refactored into SolidJS components.

**Server-side data loading:**

```astro
---
import Base from '../layouts/Base.astro';
import Configurator from '../components/Configurator.tsx';
import { db } from '../lib/db';
// Load catalog same as Summary page

// Check for query params (pre-selection from Summary page)
const hubTypeParam = Astro.url.searchParams.get('hub_type');
const hubTierParam = Astro.url.searchParams.get('hub_tier');
const sensorTierParam = Astro.url.searchParams.get('sensor_tier');
---
<Base title="Pool Security — Build">
  <Configurator
    client:load
    catalog={catalog}
    initialHubType={hubTypeParam}
    initialHubTier={hubTierParam}
    initialSensorTier={sensorTierParam}
  />
</Base>
```

**Configurator component (`Configurator.tsx`):**

Port of the current 4-step wizard. Internal SolidJS signals replace the mutable `state` object:

```tsx
const [step, setStep] = createSignal(1);
const [hubType, setHubType] = createSignal<string | null>(initialHubType);
const [hubTier, setHubTier] = createSignal<HubTier | null>(null);
const [sensorTier, setSensorTier] = createSignal<SensorTier | null>(null);
const [qty, setQty] = createSignal(4);
```

**Pre-selection:** If URL query params are present (`hub_type`, `hub_tier`, `sensor_tier`), resolve them against the catalog and set the initial signals accordingly. Auto-advance to the Review step (step 4) if all three are set.

**Step flow** — identical to current behavior:

1. **Hub type** — 3 cards (None, Zigbee, LoRaWAN). Selecting "None" skips to step 3.
2. **Hub tier** — 2 cards filtered by hub type. Skipped if hub type is "none".
3. **Sensor tier** — 2 cards filtered by hub type.
4. **Review** — 3D viewer, BOM, fleet sizer, save button.

**Step 4 additions (new):**

- **"Save configuration" button** — calls `POST /api/configs` with the current selections. Shows a small inline text input for the config name (default: auto-generated like "Zigbee Premium × 4"). On success, shows a toast/confirmation.
- **"View all builds" link** — navigates to `/` (Summary page).

**Sub-components:**

- **`OptionCard.tsx`** — reusable card component. Props: `title`, `badge`, `badgeClass`, `description`, `price?`, `priceNote?`, `specs`, `selected`, `onClick`. Renders the card with radio indicator, badge, specs pills.
- **`Viewer3D.tsx`** — SolidJS wrapper around the Three.js scene. Uses `onMount` to initialize, `createEffect` to react to `sensorTier()` color changes and rebuild the model. Exports the same `build3DModel()` and `init3D()` logic, adapted to use a ref for the canvas element.
- **`FleetSizer.tsx`** — qty slider, fleet metrics grid, total bar. Props: `hubTier`, `sensorTier`, `hubType`, `qty`, `onQtyChange`. All derived values (total cost, coverage, battery, range) computed with `createMemo`.

---

## API Routes

All API routes use `better-sqlite3` via the Drizzle `db` instance. Prices are stored in cents and converted to dollars in the API response.

### `GET /api/configs`

Returns all saved configurations with joined catalog data.

**Response:**
```json
[
  {
    "id": 1,
    "name": "My Zigbee Build",
    "hubType": { "id": "zigbee", "name": "Zigbee hub" },
    "hubTier": { "id": "zigbee-premium", "name": "Zigbee hub — premium", "price": 225 },
    "sensorTier": { "id": "zb-cheap", "name": "Zigbee sensor — budget", "price": 54 },
    "qty": 4,
    "totalCost": 441,
    "createdAt": "2026-04-01T12:00:00Z",
    "updatedAt": "2026-04-01T12:00:00Z"
  }
]
```

### `POST /api/configs`

Save a new configuration.

**Request body:**
```json
{
  "name": "My Build",
  "hubTypeId": "zigbee",
  "hubTierId": "zigbee-premium",
  "sensorTierId": "zb-cheap",
  "qty": 4
}
```

**Validation:**
- `hubTypeId` must exist in `hub_types`
- `hubTierId` must be null/omitted when `hubTypeId` is `'none'`, otherwise must exist in `hub_tiers` and match the `hub_type_id`
- `sensorTierId` must exist in `sensor_tiers` and its `hub_type_id` must match `hubTypeId`
- `qty` must be integer 1–8
- `name` must be non-empty string, max 100 chars

**Response:** `201` with the created config object.

### `GET /api/configs/[id]`

Returns a single saved configuration by ID.

**Response:** Same shape as one element of the list response. `404` if not found.

### `PUT /api/configs/[id]`

Update an existing saved configuration (name, qty, or selections).

**Request body:** Same as POST. Partial updates allowed.

**Response:** `200` with updated config. `404` if not found.

### `DELETE /api/configs`

Delete a saved configuration.

**Request body:**
```json
{ "id": 1 }
```

**Response:** `200` with `{ "deleted": true }`. `404` if not found.

---

## Styling

### Tailwind v4 Setup

**`src/styles/global.css`:**

```css
@import "tailwindcss";

@theme {
  /* Background scale */
  --color-bg-deep: #0a0b0f;
  --color-bg-surface: #12131a;
  --color-bg-card: #181922;
  --color-bg-card-hover: #1e1f2a;
  --color-bg-elevated: #22232e;

  /* Accent palette */
  --color-accent: #00e5a0;
  --color-accent-dim: #00c98b;
  --color-accent-blue: #3b82f6;
  --color-accent-amber: #f59e0b;
  --color-accent-coral: #f97066;
  --color-accent-purple: #a78bfa;

  /* Text scale */
  --color-text-primary: #e8e9ed;
  --color-text-secondary: #8b8d98;
  --color-text-tertiary: #565868;

  /* Border scale */
  --color-border: rgba(255, 255, 255, 0.06);
  --color-border-hover: rgba(255, 255, 255, 0.12);
  --color-border-active: rgba(0, 229, 160, 0.4);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Fonts */
  --font-display: 'Outfit', sans-serif;
  --font-mono: 'DM Mono', monospace;
}
```

This maps the existing CSS custom properties into Tailwind's theme system, enabling classes like `bg-bg-deep`, `text-accent`, `rounded-lg`, `font-display`, `font-mono`.

### Approach

- Use Tailwind utility classes for all layout, spacing, colors, typography.
- No separate CSS files per component — all styling via class names in JSX/Astro templates.
- Animations (fadeUp, pulse-dot) defined as `@keyframes` in `global.css` and applied via Tailwind's `animate-*` or inline `style` attributes.
- The existing design language (dark theme, card-based, monospace accents, colored badges) is preserved exactly.

---

## SolidJS Component Specifications

### `SummaryTable.tsx`

```
Props:
  catalog: {
    hubTypes: HubType[]
    hubTiers: HubTier[]
    sensorTiers: SensorTier[]
    hubParts: Record<string, Part[]>
    sensorParts: Record<string, Part[]>
  }
  savedConfigs: SavedConfig[]

Signals:
  archFilter: string | null         — filter by hub type
  tierFilter: 'budget' | 'premium' | null
  expandedRow: number | null        — index of expanded row

Derived:
  rows: BuildCombo[]                — computed from catalog, 10 total
  filteredRows: BuildCombo[]        — rows after archFilter + tierFilter

Table:
  createSolidTable({
    get data() { return filteredRows() },
    columns: [...],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
```

**BuildCombo type:**
```ts
type BuildCombo = {
  hubType: HubType;
  hubTier: HubTier | null;
  sensorTier: SensorTier;
  hubCost: number;          // dollars
  sensorCost: number;       // per-unit dollars
  totalAtFour: number;      // hub + 4× sensor
  battery: string;
  commRange: string;
  partCount: number;        // total BOM items
  hubParts: Part[];
  sensorParts: Part[];
};
```

**Row expansion:** When a row is clicked, toggle `expandedRow`. If expanded, render a sub-row spanning all columns that shows two BOM tables (hub parts + sensor parts) styled identically to the Build page's BOM section.

**"Build this" action:** Each row has a button/link that navigates to `/build?hub_type=X&hub_tier=Y&sensor_tier=Z`.

### `Configurator.tsx`

```
Props:
  catalog: same as SummaryTable
  initialHubType?: string
  initialHubTier?: string
  initialSensorTier?: string

Signals:
  step: number (1–4)
  hubType: string | null
  hubTier: HubTier | null
  sensorTier: SensorTier | null
  qty: number (1–8)
  saving: boolean
  saveError: string | null

Children:
  Step 1: <For each={catalog.hubTypes}> → <OptionCard />
  Step 2: <For each={filteredHubTiers()}> → <OptionCard />
  Step 3: <For each={filteredSensorTiers()}> → <OptionCard />
  Step 4: <Viewer3D />, BOM list, <FleetSizer />, Save button
```

**Save flow (step 4):**
1. User clicks "Save configuration"
2. Inline text input appears with auto-generated name
3. User confirms → `POST /api/configs`
4. On success: toast confirmation, button changes to "Saved" with checkmark
5. On error: inline error message

### `Viewer3D.tsx`

```
Props:
  accentColor: string       — hex color from sensor tier
  visible: boolean          — only render when step 4 is active

Refs:
  canvasRef: HTMLCanvasElement

Lifecycle:
  onMount → init3D() (scene, camera, renderer, lights, drag handlers, animation loop)
  createEffect on accentColor → build3DModel(color)
  onCleanup → dispose renderer, cancel animation frame
```

The 3D model geometry and materials are identical to the current `build3DModel()` function. The only change is wrapping it in SolidJS lifecycle hooks instead of global variables.

### `FleetSizer.tsx`

```
Props:
  hubType: string
  hubTier: HubTier | null
  sensorTier: SensorTier
  qty: number
  onQtyChange: (n: number) => void

Derived (createMemo):
  hubCost: number
  sensorTotal: number
  grandTotal: number
  coverage: number          — m², using coverPerUnit logic
  breakdown: string         — "Hub: $X + 4× sensor @ $Y = $Z"
```

### `OptionCard.tsx`

```
Props:
  title: string
  badge: string
  badgeClass: string
  description: string
  price?: number            — omitted for hub type cards
  priceNote?: string        — "one-time" | "per unit"
  specs: string[]
  selected: boolean
  disabled?: boolean
  onClick: () => void
```

Renders the same card structure as the current `.option-card` elements, using Tailwind classes.

---

## TypeScript Types (`src/lib/data.ts`)

```ts
export type HubType = {
  id: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  specs: string[];
};

export type HubTier = {
  id: string;
  hubTypeId: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  price: number;        // dollars (converted from cents on read)
  specs: string[];
};

export type SensorTier = {
  id: string;
  hubTypeId: string;
  name: string;
  badge: string;
  badgeClass: string;
  description: string;
  price: number;        // per-unit dollars
  battery: string;
  commRange: string;
  accentColor: string;  // hex
  specs: string[];
};

export type Part = {
  id: number;
  name: string;
  description: string;
  price: number;        // dollars
  sortOrder: number;
};

export type SavedConfig = {
  id: number;
  name: string;
  hubTypeId: string;
  hubTierId: string | null;
  sensorTierId: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
};

export type Catalog = {
  hubTypes: HubType[];
  hubTiers: HubTier[];
  sensorTiers: SensorTier[];
  hubParts: Record<string, Part[]>;     // keyed by hubTierId
  sensorParts: Record<string, Part[]>;  // keyed by sensorTierId
};
```

---

## Navigation & Shared Components

### `Header.astro`

Identical to current header: sticky, blurred background, logo (PoolGuard / configurator), live-dot with "Prices live — Apr 2026".

### `Nav.astro`

Two-tab navigation bar below the header:

```
[ Summary ]  [ Build ]
```

- Styled as pill tabs (similar to current step nav but simpler — just two options)
- Active tab has `bg-bg-card` background and `text-text-primary`
- Inactive tab has `text-text-tertiary` with hover state
- Active state determined by `Astro.url.pathname === '/'` vs `'/build'`

### `Footer.astro`

Identical to current footer. "Reset configurator" link replaced with navigation links to both pages.

---

## Data Flow Summary

```
SQLite (sqlite.db)
  ↓ Drizzle ORM
  ↓
Astro page (server-side)
  ↓ props
  ↓
SolidJS island (client-side, hydrated)
  ↓ fetch()
  ↓
Astro API routes (/api/configs)
  ↓ Drizzle ORM
  ↓
SQLite (sqlite.db)
```

- **Catalog data** (hub types, tiers, sensor tiers, parts): loaded server-side in `.astro` pages, passed as props to SolidJS islands. Read-only. Never modified by the client.
- **Saved configs**: read server-side for initial page load, mutated via client-side `fetch()` calls to API routes.

---

## Scripts

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/seed.ts",
    "db:setup": "npm run db:generate && npm run db:migrate && npm run db:seed"
  }
}
```

### First-run setup

```bash
sfw npm install
npm run db:setup
npm run dev
```

---

## Migration Path from index.html

| Current (index.html) | New (Astro) |
|---|---|
| Inline `<style>` with CSS vars | `global.css` with Tailwind `@theme` + utility classes |
| Inline `<script>` with global state | SolidJS signals in `Configurator.tsx` |
| DOM manipulation (`innerHTML`, `textContent`) | SolidJS reactive JSX (`<For>`, `<Show>`, signals) |
| Global `HUB_TYPES`, `HUB_TIERS`, `SENSOR_TIERS` | SQLite tables, loaded server-side via Drizzle |
| No persistence | `saved_configs` table + API routes |
| No routing | Astro file-based routing: `/` and `/build` |
| CDN Three.js | `three` npm package, imported in `Viewer3D.tsx` |
| No build step | Astro build with Vite |
| Single page | Two pages with shared layout |

---

## Out of Scope

These are explicitly **not** part of this spec:

- User authentication / multi-user support
- Real-time price fetching from Amazon/suppliers
- Export to PDF / CSV
- Mobile app or PWA
- Deployment configuration (Docker, cloud hosting)
- Unit/integration tests (can be added separately)
- Dark/light theme toggle (dark only, matching current design)
