import { defineConfig } from 'astro/config';
import { resolve } from 'node:path';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import { searchForWorkspaceRoot } from 'vite';

const threadPilledRoot = '/Users/alechp/Code/threadpilled/embed';
const threadPilledVanillaEntry = resolve(threadPilledRoot, 'packages/embed/dist/vanilla/index.mjs');
const workspaceRoot = searchForWorkspaceRoot(process.cwd());

export default defineConfig({
  server: { port: 5187 },
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solidJs()],
  vite: {
    resolve: {
      alias: {
        '@threadpilled-embed-vanilla': threadPilledVanillaEntry,
      },
    },
    server: {
      fs: {
        allow: [workspaceRoot, threadPilledRoot],
      },
    },
    plugins: [tailwindcss()],
  },
});
