import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  dialect: 'sqlite',
  out: './drizzle',
  dbCredentials: {
    url: './sqlite.db',
  },
} satisfies Config;
