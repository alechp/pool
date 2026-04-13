import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// D1 only accepts string | number | null | ArrayBuffer in bind params.
// BetterAuth passes Date objects and booleans which D1 rejects.
// D1PreparedStatement.bind is non-writable on the native Workerd object,
// so we must Proxy the statement itself to intercept .bind() calls.
function sanitizeParam(arg: unknown): unknown {
  if (arg instanceof Date) return arg.toISOString();
  if (typeof arg === 'boolean') return arg ? 1 : 0;
  return arg;
}

function wrapStmt(stmt: D1PreparedStatement): D1PreparedStatement {
  return new Proxy(stmt, {
    get(target, prop, receiver) {
      if (prop === 'bind') {
        return (...args: unknown[]) => {
          return target.bind(...args.map(sanitizeParam));
        };
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') return val.bind(target);
      return val;
    },
  });
}

function wrapD1(d1: D1Database): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      if (prop === 'prepare') {
        return (query: string) => wrapStmt(target.prepare(query));
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') return val.bind(target);
      return val;
    },
  });
}

export function getDb(d1: D1Database) {
  return drizzle(wrapD1(d1), { schema });
}

export type AppDatabase = ReturnType<typeof getDb>;
