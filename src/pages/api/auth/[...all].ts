import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

export const ALL: APIRoute = async (context) => {
  const db = getDb(context.locals.runtime.env.DB);
  const auth = createAuth(db);
  return auth.handler(context.request);
};
