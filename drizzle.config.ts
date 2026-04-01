import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  dialect: 'sqlite',
  dbCredentials: { url: './sqlite.db' },
  out: './drizzle',
} satisfies Config;
