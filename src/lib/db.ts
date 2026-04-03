import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS bom_selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_key TEXT NOT NULL,
    part_name TEXT NOT NULL,
    selected_url TEXT NOT NULL,
    selected_supplier TEXT,
    selection_source TEXT NOT NULL,
    filter_mode TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

export const db = drizzle(sqlite, { schema });
