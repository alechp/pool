import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { AppDatabase } from './db';
import * as schema from './schema';

const ALLOWED_EMAILS = ['me@alechp.com'];

export function createAuth(db: AppDatabase) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    hooks: {
      before: async (context) => {
        if (context.path === '/sign-up/email') {
          const body = context.body as { email?: string };
          if (
            !body?.email ||
            !ALLOWED_EMAILS.includes(body.email.toLowerCase())
          ) {
            return context.json(
              { error: 'Registration is not open.' },
              { status: 403 },
            );
          }
        }
      },
    },
  });
}
