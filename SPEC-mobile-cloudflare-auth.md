# Spec: Mobile Responsiveness, Cloudflare Deployment, and BetterAuth

**Branch:** `feat/mobile-cloudflare-auth`
**Date:** 2026-04-10
**Status:** Draft

---

## Table of Contents

1. [Mobile Responsiveness](#1-mobile-responsiveness)
2. [Cloudflare Deployment](#2-cloudflare-deployment)
3. [BetterAuth Configuration](#3-betterauth-configuration)
4. [Implementation Order](#4-implementation-order)
5. [Risk & Open Questions](#5-risk--open-questions)

---

## 1. Mobile Responsiveness

### 1.1 Current State Audit

The app uses Tailwind CSS v4 with `md:` breakpoint patterns. Some components have mobile-first support, but there are significant gaps.

#### What Already Works
- **ChatSidebar**: Has mobile overlay mode (`md:hidden` backdrop), max-width capped at `92vw`
- **Index page cards**: Grid collapses from 3-col to 1-col on small screens
- **Typography**: Some headings scale (`text-5xl md:text-6xl`)

#### What Needs Work

| Component / Area | Issue | Fix |
|---|---|---|
| **Header** (`Header.astro`) | No hamburger menu, logo and "Prices live" text can collide on small screens | Add responsive layout; hide/abbreviate right-side text on mobile |
| **Nav** (`Nav.astro`) | Tab bar is `inline-flex` and can overflow horizontally on narrow screens | Make full-width on mobile, or switch to horizontally scrollable with `overflow-x-auto` |
| **ChatSidebar** (`ChatSidebar.tsx`) | Resize handle (drag-to-resize) is a poor mobile UX; sidebar width fixed to `380px` minimum | On mobile (`<md`), force full-width or near-full-width; hide resize handle; add swipe-to-dismiss |
| **ChatSidebar toggle button** | Vertical "AI Advisor" text on right edge is hard to tap on mobile | Increase tap target; consider a floating action button (FAB) at bottom-right on mobile |
| **Configurator** (`Configurator.tsx`) | Multi-step wizard layout likely overflows on small screens | Audit each step; ensure cards/grids collapse to single column |
| **BOM tables** (`BomWorkspace.tsx`) | `@tanstack/solid-table` renders wide tables that overflow | Wrap in `overflow-x-auto` container; consider card-based layout on mobile |
| **BOM compare** (`bom/compare.astro`) | Side-by-side comparison is unusable on narrow viewports | Stack vertically on mobile; add toggle/tabs to switch between builds |
| **3D Viewer** (`Viewer3D.tsx`, `HubViewer3D.tsx`) | Three.js canvas may not resize correctly; touch gestures (rotate/zoom) may conflict with scroll | Ensure canvas uses `ResizeObserver`; limit orbit controls on mobile |
| **HomeAdvisor** (`HomeAdvisor.tsx`) | Inline advisor with demo walkthrough may not fit narrow screens | Ensure walkthrough steps stack vertically; shrink demo cards |
| **LandingSignalScene** (`LandingSignalScene.astro`) | Complex visual scene may have fixed pixel dimensions | Ensure all widths are responsive (`max-w-full`, percentage-based) |
| **Footer** (`Footer.astro`) | Not audited | Verify horizontal layout doesn't overflow |
| **Index page** (`index.astro`) | `px-8` padding is generous on very small screens (320px) | Reduce to `px-4 md:px-8` |

### 1.2 Breakpoint Strategy

Use Tailwind's default breakpoints consistently:

| Token | Width | Target |
|---|---|---|
| (default) | `<640px` | Phone portrait |
| `sm:` | `>=640px` | Phone landscape / small tablet |
| `md:` | `>=768px` | Tablet portrait |
| `lg:` | `>=1024px` | Tablet landscape / desktop |
| `xl:` | `>=1280px` | Wide desktop |

### 1.3 Implementation Tasks

#### 1.3.1 Global Layout
- [ ] Add `<meta name="viewport">` check — already present in `Base.astro` (confirmed)
- [ ] Reduce outer padding: `px-4 sm:px-6 md:px-8` across `index.astro`, `Nav.astro`, `Header.astro`
- [ ] Ensure `max-w-[1200px]` container doesn't prevent content from breathing on mobile

#### 1.3.2 Header
- [ ] Stack or hide "Prices live" text below `sm:` breakpoint
- [ ] Ensure logo + title don't wrap awkwardly

#### 1.3.3 Navigation
- [ ] Make tab bar full-width and horizontally scrollable on mobile:
  ```html
  <div class="overflow-x-auto scrollbar-hide">
    <div class="flex gap-0.5 ... min-w-max">
  ```
- [ ] Add `scrollbar-hide` utility or hide scrollbar via CSS

#### 1.3.4 ChatSidebar (Mobile Overhaul)
- [ ] On `<md`: render as full-screen overlay (not 380px panel)
- [ ] Hide resize handle on mobile
- [ ] Replace vertical toggle with floating action button (FAB):
  ```
  Fixed bottom-right, 56px circle, accent bg, chat icon
  Position: bottom-6 right-4
  ```
- [ ] Add swipe-right-to-dismiss gesture (pointer events based)
- [ ] Ensure input area stays above mobile keyboard (`position: fixed` bottom, or use `visualViewport` API)

#### 1.3.5 Configurator Steps
- [ ] Audit all step layouts for single-column collapse
- [ ] Ensure action buttons are full-width on mobile
- [ ] Test persona selection cards stacking

#### 1.3.6 BOM Tables
- [ ] Wrap all `<table>` elements in `overflow-x-auto` containers
- [ ] Consider adding a "card view" toggle for mobile (table rows → stacked cards)
- [ ] Ensure sticky headers work correctly within scrollable containers

#### 1.3.7 3D Viewers
- [ ] Set canvas to `width: 100%` with aspect ratio container
- [ ] Limit Three.js OrbitControls on touch: disable pan, keep rotate + pinch-zoom
- [ ] Add `touch-action: none` on canvas to prevent scroll conflicts

#### 1.3.8 Testing
- [ ] Test at 320px, 375px, 414px, 768px, 1024px widths
- [ ] Verify iOS Safari bottom bar doesn't obscure input fields
- [ ] Test with Chrome DevTools device emulator for all pages

---

## 2. Cloudflare Deployment

### 2.1 Current State

- **Adapter:** `@astrojs/node` (standalone mode)
- **Database:** `better-sqlite3` (local file `sqlite.db`)
- **Runtime assumptions:** Node.js APIs (`fs`, `path`, `process`), local file system for SQLite
- **External dependency:** Local filesystem path to `threadpilled/embed` package (hardcoded absolute path)

### 2.2 Migration Plan

Cloudflare Pages/Workers uses the V8 runtime (not Node.js). This requires changes to the adapter, database layer, and any Node.js-specific code.

#### 2.2.1 Adapter Swap

Replace `@astrojs/node` with `@astrojs/cloudflare`:

```bash
sfw bun add @astrojs/cloudflare
# Remove @astrojs/node from dependencies
```

Update `astro.config.mjs`:
```js
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  // ...
});
```

#### 2.2.2 Database: SQLite → Cloudflare D1

Cloudflare D1 is a serverless SQLite-compatible database. Drizzle ORM supports D1 natively.

**Steps:**
- [ ] Create a D1 database via `wrangler`:
  ```bash
  npx wrangler d1 create pool-security-db
  ```
- [ ] Add D1 binding to `wrangler.toml`:
  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "pool-security-db"
  database_id = "<id-from-create>"
  ```
- [ ] Swap Drizzle driver from `better-sqlite3` to `drizzle-orm/d1`:
  ```ts
  // src/lib/db.ts — updated
  import { drizzle } from 'drizzle-orm/d1';
  import * as schema from './schema';

  export function getDb(d1: D1Database) {
    return drizzle(d1, { schema });
  }
  ```
- [ ] Access D1 from Astro API routes via `Astro.locals.runtime.env.DB`:
  ```ts
  // In any API route
  export async function POST({ locals }: APIContext) {
    const db = getDb(locals.runtime.env.DB);
    // ...
  }
  ```
- [ ] Migrate existing Drizzle migrations to D1 format:
  ```bash
  npx wrangler d1 migrations apply pool-security-db --local  # local dev
  npx wrangler d1 migrations apply pool-security-db           # production
  ```
- [ ] Update `drizzle.config.ts` for D1 dialect
- [ ] Seed D1 with existing seed script (adapt for D1 API)

**Schema stays the same** — D1 is SQLite-compatible, so the Drizzle schema in `schema.ts` requires no changes.

#### 2.2.3 Environment Variables

Move from `.env` to Cloudflare secrets:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Access in Astro routes:
```ts
const apiKey = locals.runtime.env.ANTHROPIC_API_KEY;
```

#### 2.2.4 Remove Node.js-Specific Code

Audit for Node.js APIs that won't work on Cloudflare Workers:

| File | Issue | Fix |
|---|---|---|
| `astro.config.mjs` | `import { resolve } from 'node:path'` | OK at build time (config runs in Node during build) |
| `astro.config.mjs` | `searchForWorkspaceRoot` | OK at build time |
| `astro.config.mjs` | Absolute path to `threadpilled/embed` | Bundle at build time; ensure Vite resolves this during build, not runtime |
| `src/lib/db.ts` | `better-sqlite3` (native Node addon) | Replace with D1 driver (see 2.2.2) |
| `drizzle.config.ts` | Build-time only, OK to keep Node.js APIs | No change needed |
| API routes | Verify no `fs`, `child_process`, etc. | Audit all `src/pages/api/*.ts` files |

#### 2.2.5 Threadpilled Embed Dependency

The current config references a local filesystem path:
```js
const threadPilledRoot = '/Users/alechp/Code/threadpilled/embed';
```

**Options:**
1. **Publish as npm package** — best long-term solution; install via npm/bun
2. **Bundle at build time** — Vite already resolves this at build; ensure it's inlined into the client bundle (no runtime filesystem access needed). Verify with `astro build` that the import resolves correctly.
3. **Copy into project** — vendor the built dist files into `public/` or `src/lib/`

**Recommendation:** Option 2 should work since Vite resolves the alias at build time. Verify by running `astro build` and checking the output bundle.

#### 2.2.6 Wrangler Configuration

Create `wrangler.toml` at project root:

```toml
name = "pool-security-configurator"
main = "dist/_worker.js"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[site]
bucket = "./dist/client"

[[d1_databases]]
binding = "DB"
database_name = "pool-security-db"
database_id = "<from-d1-create>"

[vars]
# Non-secret env vars here

# Secrets set via: wrangler secret put ANTHROPIC_API_KEY
```

#### 2.2.7 Build & Deploy Scripts

Update `package.json`:
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler pages dev dist",
    "deploy": "astro build && wrangler pages deploy dist",
    "d1:migrate:local": "wrangler d1 migrations apply pool-security-db --local",
    "d1:migrate:prod": "wrangler d1 migrations apply pool-security-db"
  }
}
```

#### 2.2.8 Local Development

Cloudflare's `wrangler` provides local D1 emulation:
- `wrangler pages dev` runs a local Miniflare environment
- D1 is emulated locally with SQLite under `.wrangler/`
- Can also use `astro dev` with `platformProxy: { enabled: true }` for D1 access during `astro dev`

#### 2.2.9 Static Assets

Cloudflare Pages serves static files from `dist/client/`. No changes needed — Astro outputs client assets there by default with the Cloudflare adapter.

#### 2.2.10 Limits & Considerations

| Concern | Cloudflare Limit | Our Usage | Status |
|---|---|---|---|
| Worker size | 10 MB (compressed) | Should be fine | Verify after build |
| D1 row size | 1 MB per row | Well under | OK |
| D1 database size | 10 GB (paid) / 500 MB (free) | Minimal | OK |
| Subrequest limit | 1000 per request | Chat API makes 1 external call | OK |
| CPU time | 30s (paid) / 10ms (free) | Chat API waits on Anthropic | Use paid plan; streaming may help |
| Request body size | 100 MB | Image uploads (base64) may be large | Enforce client-side limit (<5MB) |

---

## 3. BetterAuth Configuration

### 3.1 Overview

[BetterAuth](https://www.better-auth.com/) is a framework-agnostic TypeScript auth library. We'll configure it with:
- **Email + password** authentication
- **Registration locked** to `me@alechp.com` only
- **Session management** via cookies (works with Cloudflare Workers)

### 3.2 Dependencies

```bash
sfw bun add better-auth
```

### 3.3 Auth Server Setup

Create `src/lib/auth.ts`:

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';

export function createAuth(db: ReturnType<typeof getDb>) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    emailAndPassword: {
      enabled: true,
      // Lock registration to allowed emails only
      sendResetPassword: async () => {
        // No-op for now — single user, no email service needed
      },
    },
    user: {
      // Hook into user creation to enforce email allowlist
      additionalFields: {},
    },
    advanced: {
      // Restrict sign-up to allowed emails
    },
  });
}
```

### 3.4 Email Allowlist Enforcement

BetterAuth supports a `before` hook on user creation. Use this to reject registrations from non-allowed emails:

```ts
// src/lib/auth.ts
const ALLOWED_EMAILS = ['me@alechp.com'];

export function createAuth(db: ReturnType<typeof getDb>) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    emailAndPassword: {
      enabled: true,
    },
    hooks: {
      before: [
        {
          matcher: (context) => context.path === '/sign-up/email',
          handler: async (context) => {
            const body = context.body as { email?: string };
            if (!body?.email || !ALLOWED_EMAILS.includes(body.email.toLowerCase())) {
              return context.json({ error: 'Registration is not open.' }, { status: 403 });
            }
          },
        },
      ],
    },
  });
}
```

This approach:
- Blocks all registration attempts from non-allowed emails at the API level
- Returns a generic error (doesn't reveal which emails are allowed)
- Is easily extensible later (add more emails to the array, or move to env var / DB config)

### 3.5 Database Schema for Auth

BetterAuth requires its own tables. Generate them:

```bash
npx better-auth generate  # outputs migration SQL
```

BetterAuth needs these tables (auto-generated):
- `user` — id, email, name, image, emailVerified, createdAt, updatedAt
- `session` — id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt
- `account` — id, userId, accountId, providerId, accessToken, refreshToken, etc.
- `verification` — id, identifier, value, expiresAt, createdAt, updatedAt

These will coexist with the existing Drizzle schema. BetterAuth's Drizzle adapter manages them separately.

### 3.6 Astro Middleware

Create `src/middleware.ts` to handle auth on every request:

```ts
import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';
import { getDb } from './lib/db';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/',    // BetterAuth's own API routes
  '/login',        // Login page
  '/register',     // Registration page
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow BetterAuth API routes and public pages through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return next();
  }

  // Initialize auth with D1
  const db = getDb(context.locals.runtime.env.DB);
  const auth = createAuth(db);

  // Validate session
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });

  if (!session) {
    // Redirect unauthenticated users to login
    return context.redirect('/login');
  }

  // Attach user to locals for downstream use
  context.locals.user = session.user;
  context.locals.session = session.session;

  return next();
});
```

### 3.7 Auth API Route

BetterAuth provides a catch-all API handler. Create `src/pages/api/auth/[...all].ts`:

```ts
import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

export const ALL: APIRoute = async (context) => {
  const db = getDb(context.locals.runtime.env.DB);
  const auth = createAuth(db);
  return auth.handler(context.request);
};
```

### 3.8 Login Page

Create `src/pages/login.astro` — a minimal login page with email + password form:

- Use the existing dark theme (bg-deep, accent colors, Outfit font)
- SolidJS client component for form state + submission
- POST to BetterAuth's `/api/auth/sign-in/email` endpoint
- On success, redirect to `/`
- Show error message on failure
- Link to `/register` for first-time setup

### 3.9 Registration Page

Create `src/pages/register.astro` — same styling as login:

- POST to BetterAuth's `/api/auth/sign-up/email`
- Server-side hook rejects non-allowed emails (see 3.4)
- Show "Registration is not open" error for blocked emails
- On success, redirect to `/login` with success message

### 3.10 Logout

Add a logout button to `Header.astro`:

```astro
---
const user = Astro.locals.user;
---
<Show when={user}>
  <form method="POST" action="/api/auth/sign-out">
    <button type="submit">Sign out</button>
  </form>
</Show>
```

### 3.11 Type Safety

Extend Astro's `Locals` type in `src/env.d.ts`:

```ts
/// <reference types="astro/client" />

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        ANTHROPIC_API_KEY: string;
      };
    };
    user?: User;
    session?: Session;
  }
}
```

### 3.12 Protecting API Routes

All existing API routes (`/api/chat`, `/api/configs`, etc.) are already behind the middleware. No per-route changes needed — unauthenticated requests are redirected before they reach any route handler.

For API routes specifically (which should return 401 instead of redirect):

```ts
// Add to middleware
if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### 3.13 Session Storage on Cloudflare

BetterAuth stores sessions in the database (D1). Cookie-based session tokens work natively on Cloudflare Workers — no special configuration needed.

Set secure cookie options:

```ts
betterAuth({
  // ...
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },
  trustedOrigins: ['https://your-domain.com'],
});
```

---

## 4. Implementation Order

Work should proceed in this order, as each phase builds on the previous:

### Phase 1: Mobile Responsiveness
**Why first:** No infrastructure changes; pure CSS/component work. Can be tested immediately.

1. Global layout padding adjustments
2. Header + Nav mobile fixes
3. ChatSidebar mobile overhaul (FAB, full-screen overlay, keyboard handling)
4. Configurator and BOM table responsive audit
5. 3D viewer touch/resize fixes
6. Cross-device testing

### Phase 2: Cloudflare Deployment
**Why second:** Infrastructure migration. Need this before auth, since auth config depends on the runtime.

1. Install `@astrojs/cloudflare`, remove `@astrojs/node`
2. Create `wrangler.toml`
3. Migrate `db.ts` from `better-sqlite3` to D1 driver
4. Update all API routes to get D1 from `locals.runtime.env`
5. Verify threadpilled embed bundles correctly at build time
6. Test locally with `wrangler pages dev`
7. Create D1 database, run migrations, seed data
8. Deploy to Cloudflare Pages
9. Set secrets (`ANTHROPIC_API_KEY`)
10. Verify all routes work in production

### Phase 3: BetterAuth
**Why last:** Depends on Cloudflare runtime (D1) being in place.

1. Install `better-auth`
2. Generate auth schema, run D1 migration
3. Create `src/lib/auth.ts` with email allowlist hook
4. Create `src/pages/api/auth/[...all].ts` catch-all route
5. Create `src/middleware.ts` with session validation
6. Create login + register pages
7. Add logout to header
8. Update `env.d.ts` types
9. Test full flow: register `me@alechp.com` → login → access app → logout
10. Test rejection: attempt registration with other email → blocked

---

## 5. Risk & Open Questions

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Anthropic API latency on CF Workers** | Medium | Workers have 30s CPU limit (paid plan); Anthropic calls are I/O-bound (doesn't count against CPU). Test with real calls. Consider streaming responses. |
| **D1 migration data loss** | High | Export current SQLite data before migration. Seed D1 fresh. Existing user data is all in localStorage (conversations) — no server-side user data to lose. |
| **Threadpilled embed build resolution** | Medium | Test `astro build` before any Cloudflare changes. If it fails, vendor the dist files. |
| **BetterAuth + D1 compatibility** | Low | BetterAuth's Drizzle adapter supports SQLite/D1. Verify with their docs for Cloudflare-specific examples. |
| **Three.js bundle size** | Medium | Three.js is large (~600KB). May push close to CF 10MB worker limit. Tree-shake unused modules. Alternatively, load Three.js from CDN on client side (it's client-only). |

### Open Questions

1. **Custom domain?** — What domain will this deploy to? Needed for `trustedOrigins` in BetterAuth config and CORS settings.
2. **Cloudflare plan?** — Free vs paid Workers plan affects CPU time limits (10ms free vs 30s paid). The AI chat route likely needs the paid plan.
3. **Email service for password reset?** — For now we skip this (single user can be manually reset). Later, could add Resend/Mailgun integration.
4. **Should existing localStorage conversations survive auth?** — After auth is added, conversations are still client-side. No migration needed, but consider tying conversations to authenticated user in the future.
5. **Threadpilled embed** — Should we publish this as a package or vendor it? Hardcoded local path won't work in CI/CD.
