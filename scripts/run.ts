#!/usr/bin/env bun
import { $ } from "bun";
import { resolve, dirname } from "path";
import { existsSync, realpathSync } from "fs";

// Resolve project root from this script's real location (handles symlinks)
const scriptReal = realpathSync(process.argv[1]);
const projectRoot = resolve(dirname(scriptReal), "..");

process.chdir(projectRoot);

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";

const PORT = 5187;

const ROUTES = [
  { label: 'Pricing', path: '/' },
  { label: 'Quick Build', path: '/build' },
  { label: 'Custom Build', path: '/build/custom' },
  { label: 'Personas', path: '/personas' },
  { label: 'API: Configs', path: '/api/configs' },
];

const options = [
  { key: "1", label: "Run everything",       desc: "DB setup + dev server",       color: GREEN },
  { key: "2", label: "Dev server",           desc: "astro dev",                   color: CYAN },
  { key: "3", label: "DB setup",             desc: "D1 migrate + seed",           color: YELLOW },
  { key: "4", label: "DB seed only",         desc: "re-seed existing database",   color: YELLOW },
  { key: "5", label: "Build for production", desc: "astro build",                 color: MAGENTA },
  { key: "6", label: "Preview production",   desc: "astro preview",               color: MAGENTA },
  { key: "7", label: "Seed demo user",       desc: "create me@alechp.com account",color: GREEN },
  { key: "q", label: "Quit",                 desc: "",                            color: DIM },
];

function banner() {
  console.log(`
${GREEN}${BOLD}  SwimSentry v2${RESET} ${DIM}/ configurator${RESET}
${DIM}  ─────────────────────────${RESET}
`);
}

function menu() {
  for (const opt of options) {
    const desc = opt.desc ? `  ${DIM}${opt.desc}${RESET}` : "";
    console.log(`  ${opt.color}${BOLD}[${opt.key}]${RESET}  ${opt.label}${desc}`);
  }
  console.log();
}

function printRouteTable() {
  const base = `http://localhost:${PORT}`;
  const labelW = 17;  // width for label column
  const urlW = 37;    // width for URL column
  const totalW = labelW + urlW + 3; // +3 for separators

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log();
  // Top border
  console.log(`${DIM}\u250c${'\u2500'.repeat(totalW)}\u2510${RESET}`);
  // Title row
  console.log(`${DIM}\u2502${RESET}  ${GREEN}${BOLD}SwimSentry v2${RESET}${' '.repeat(totalW - 15 - base.length)}${CYAN}${base}${RESET}  ${DIM}\u2502${RESET}`);
  // Separator
  console.log(`${DIM}\u251c${'\u2500'.repeat(labelW + 2)}\u252c${'\u2500'.repeat(urlW + 2)}\u2524${RESET}`);
  // Route rows
  for (const route of ROUTES) {
    const url = `${base}${route.path}`;
    console.log(
      `${DIM}\u2502${RESET}  ${CYAN}${pad(route.label, labelW)}${RESET}${DIM}\u2502${RESET}  ${GREEN}${pad(url, urlW)}${RESET}${DIM}\u2502${RESET}`
    );
  }
  // Bottom separator
  console.log(`${DIM}\u251c${'\u2500'.repeat(labelW + 2)}\u2534${'\u2500'.repeat(urlW + 2)}\u2524${RESET}`);
  // Footer
  console.log(`${DIM}\u2502${RESET}  Press ${BOLD}Ctrl+C${RESET} to stop${' '.repeat(totalW - 24)}${DIM}\u2502${RESET}`);
  console.log(`${DIM}\u2514${'\u2500'.repeat(totalW)}\u2518${RESET}`);
  console.log();
}

async function dbSetup() {
  console.log(`\n${YELLOW}${BOLD}\u25b8 Applying D1 migrations (local)...${RESET}`);
  await $`npx wrangler d1 migrations apply swimsentry-db --local`.quiet();

  console.log(`${YELLOW}${BOLD}\u25b8 Seeding local D1...${RESET}`);
  await $`npx wrangler d1 execute swimsentry-db --local --file=scripts/seed.sql`.quiet();

  console.log(`${GREEN}${BOLD}\u2713 Database ready${RESET}\n`);
}

async function ensureDeps() {
  if (!existsSync(resolve(projectRoot, "node_modules"))) {
    console.log(`${CYAN}${BOLD}\u25b8 Installing dependencies...${RESET}`);
    await $`sfw bun install`.quiet();
    console.log(`${GREEN}${BOLD}\u2713 Dependencies installed${RESET}\n`);
  }
}

async function ensureDb() {
  if (!existsSync(resolve(projectRoot, "sqlite.db"))) {
    await dbSetup();
  }
}

async function runAll() {
  await ensureDeps();
  await dbSetup();
  printRouteTable();
  console.log(`${CYAN}${BOLD}\u25b8 Starting dev server...${RESET}\n`);
  await $`npx astro dev`;
}

async function devServer() {
  await ensureDeps();
  await ensureDb();
  printRouteTable();
  console.log(`${CYAN}${BOLD}\u25b8 Starting dev server...${RESET}\n`);
  await $`npx astro dev`;
}

async function buildProd() {
  await ensureDeps();
  await ensureDb();
  console.log(`${MAGENTA}${BOLD}\u25b8 Building for production...${RESET}\n`);
  await $`npx astro build`;
  console.log(`\n${GREEN}${BOLD}\u2713 Build complete${RESET}`);
}

async function previewProd() {
  await ensureDeps();
  printRouteTable();
  console.log(`${MAGENTA}${BOLD}\u25b8 Starting preview server (wrangler)...${RESET}\n`);
  await $`npx wrangler pages dev dist`;
}

async function seedOnly() {
  await ensureDeps();
  console.log(`${YELLOW}${BOLD}\u25b8 Seeding local D1...${RESET}`);
  await $`npx wrangler d1 execute swimsentry-db --local --file=scripts/seed.sql`.quiet();
  console.log(`${GREEN}${BOLD}\u2713 Seed complete${RESET}`);
}

async function seedDemo() {
  const url = `http://localhost:${PORT}/api/auth/sign-up/email`;
  const body = JSON.stringify({
    name: "alechp",
    email: "me@alechp.com",
    password: "gtk*vaw4QPK9mqz7qxy",
  });

  console.log(`\n${GREEN}${BOLD}\u25b8 Creating demo user (me@alechp.com)...${RESET}`);
  console.log(`${DIM}  Requires dev server running on port ${PORT}${RESET}\n`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json() as Record<string, unknown>;

    if (res.ok && data.user) {
      console.log(`${GREEN}${BOLD}\u2713 Demo user created${RESET}`);
      console.log(`${DIM}  Email: me@alechp.com${RESET}`);
    } else if (data.message === "User already exists") {
      console.log(`${YELLOW}${BOLD}\u25b8 User already exists — ready to sign in${RESET}`);
    } else {
      console.log(`${RED}${BOLD}\u2717 Failed: ${JSON.stringify(data)}${RESET}`);
    }
  } catch {
    console.log(`${RED}${BOLD}\u2717 Could not connect to localhost:${PORT}${RESET}`);
    console.log(`${DIM}  Start the dev server first: ./run dev${RESET}`);
  }
}

// Non-interactive mode: accept choice as CLI arg
const arg = process.argv[2];

if (arg) {
  const handlers: Record<string, () => Promise<void>> = {
    "1": runAll, "all": runAll,
    "2": devServer, "dev": devServer,
    "3": dbSetup, "db": dbSetup, "db:setup": dbSetup,
    "4": seedOnly, "seed": seedOnly,
    "5": buildProd, "build": buildProd,
    "6": previewProd, "preview": previewProd,
    "7": seedDemo, "demo": seedDemo, "seed-demo": seedDemo,
  };
  const handler = handlers[arg];
  if (!handler) {
    console.log(`${RED}Unknown option: ${arg}${RESET}`);
    process.exit(1);
  }
  await handler();
  process.exit(0);
}

// Interactive TUI
banner();
menu();

process.stdout.write(`  ${BOLD}Choose [1-7, q]${RESET} ${DIM}(default: 1)${RESET} \u2192 `);

for await (const line of console) {
  const choice = line.trim() || "1";

  switch (choice) {
    case "1": await runAll(); break;
    case "2": await devServer(); break;
    case "3": await dbSetup(); break;
    case "4": await seedOnly(); break;
    case "5": await buildProd(); break;
    case "6": await previewProd(); break;
    case "7": await seedDemo(); break;
    case "q": case "Q":
      console.log(`${DIM}  Bye.${RESET}`);
      process.exit(0);
    default:
      console.log(`${RED}  Unknown option: ${choice}${RESET}`);
      process.exit(1);
  }
  break;
}
