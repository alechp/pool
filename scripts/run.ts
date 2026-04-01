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

const options = [
  { key: "1", label: "Run everything",       desc: "DB setup + dev server",       color: GREEN },
  { key: "2", label: "Dev server",           desc: "astro dev",                   color: CYAN },
  { key: "3", label: "DB setup",             desc: "generate + migrate + seed",   color: YELLOW },
  { key: "4", label: "DB seed only",         desc: "re-seed existing database",   color: YELLOW },
  { key: "5", label: "Build for production", desc: "astro build",                 color: MAGENTA },
  { key: "6", label: "Preview production",   desc: "astro preview",               color: MAGENTA },
  { key: "q", label: "Quit",                 desc: "",                            color: DIM },
];

function banner() {
  console.log(`
${GREEN}${BOLD}  PoolGuard${RESET} ${DIM}/ configurator${RESET}
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

async function dbSetup() {
  console.log(`\n${YELLOW}${BOLD}▸ Generating migrations...${RESET}`);
  await $`npx drizzle-kit generate`.quiet();

  console.log(`${YELLOW}${BOLD}▸ Running migrations...${RESET}`);
  await $`npx drizzle-kit migrate`.quiet();

  console.log(`${YELLOW}${BOLD}▸ Seeding database...${RESET}`);
  await $`npx tsx scripts/seed.ts`.quiet();

  console.log(`${GREEN}${BOLD}✓ Database ready${RESET}\n`);
}

async function ensureDeps() {
  if (!existsSync(resolve(projectRoot, "node_modules"))) {
    console.log(`${CYAN}${BOLD}▸ Installing dependencies...${RESET}`);
    await $`sfw npm ci`.quiet();
    // Rebuild native modules (better-sqlite3)
    await $`cd node_modules/better-sqlite3 && npx --yes prebuild-install`.quiet();
    console.log(`${GREEN}${BOLD}✓ Dependencies installed${RESET}\n`);
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
  console.log(`${CYAN}${BOLD}▸ Starting dev server...${RESET}\n`);
  await $`npx astro dev`;
}

async function devServer() {
  await ensureDeps();
  await ensureDb();
  console.log(`${CYAN}${BOLD}▸ Starting dev server...${RESET}\n`);
  await $`npx astro dev`;
}

async function buildProd() {
  await ensureDeps();
  await ensureDb();
  console.log(`${MAGENTA}${BOLD}▸ Building for production...${RESET}\n`);
  await $`npx astro build`;
  console.log(`\n${GREEN}${BOLD}✓ Build complete${RESET}`);
}

async function previewProd() {
  await ensureDeps();
  console.log(`${MAGENTA}${BOLD}▸ Starting preview server...${RESET}\n`);
  await $`npx astro preview`;
}

async function seedOnly() {
  await ensureDeps();
  console.log(`${YELLOW}${BOLD}▸ Seeding database...${RESET}`);
  await $`npx tsx scripts/seed.ts`.quiet();
  console.log(`${GREEN}${BOLD}✓ Seed complete${RESET}`);
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

process.stdout.write(`  ${BOLD}Choose [1-6, q]${RESET} ${DIM}(default: 1)${RESET} → `);

for await (const line of console) {
  const choice = line.trim() || "1";

  switch (choice) {
    case "1": await runAll(); break;
    case "2": await devServer(); break;
    case "3": await dbSetup(); break;
    case "4": await seedOnly(); break;
    case "5": await buildProd(); break;
    case "6": await previewProd(); break;
    case "q": case "Q":
      console.log(`${DIM}  Bye.${RESET}`);
      process.exit(0);
    default:
      console.log(`${RED}  Unknown option: ${choice}${RESET}`);
      process.exit(1);
  }
  break;
}
