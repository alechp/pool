import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// D1 only accepts string | number | null | ArrayBuffer in bind params.
// BetterAuth passes Date objects and booleans which D1 rejects.
// This proxy intercepts prepare().bind() to sanitize parameter types.
function wrapD1(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      if (prop === 'prepare') {
        return (query: string) => {
          const stmt = target.prepare(query);
          const originalBind = stmt.bind.bind(stmt);
          stmt.bind = (...args: unknown[]) => {
            const sanitized = args.map((arg) => {
              if (arg instanceof Date) return arg.toISOString();
              if (typeof arg === 'boolean') return arg ? 1 : 0;
              return arg;
            });
            return originalBind(...sanitized);
          };
          return stmt;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function getDb(d1: D1Database) {
  return drizzle(wrapD1(d1), { schema });
}

export type AppDatabase = ReturnType<typeof getDb>;
