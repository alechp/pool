import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';
import { getDb } from './lib/db';

const PUBLIC_PATHS = ['/api/auth/', '/login', '/register'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow auth routes and public pages through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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
    // API routes get 401, pages get redirect
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/login');
  }

  // Attach user to locals for downstream use
  context.locals.user = session.user;
  context.locals.session = session.session;

  return next();
});
