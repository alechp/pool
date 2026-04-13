import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// TODO: Import AppDatabase type from './db' once Phase 2 exports it.
// Phase 2 will change db.ts to export: `export type AppDatabase = ReturnType<typeof getDb>;`
// For now, use `any` to avoid coupling to the current (pre-D1) db module.
type AppDatabase = any;

const ALLOWED_EMAILS = ['me@alechp.com'];

export function createAuth(db: AppDatabase) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
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
      before: [
        {
          matcher: (context) => context.path === '/sign-up/email',
          handler: async (context) => {
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
          },
        },
      ],
    },
  });
}
