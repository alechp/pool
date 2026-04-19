/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
        GROQ_API_KEY: string;
      };
    };
    user?: {
      id: string;
      email: string;
      name: string | null;
    };
    session?: {
      id: string;
      userId: string;
      token: string;
      expiresAt: Date;
    };
  }
}
