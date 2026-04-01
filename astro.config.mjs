import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  server: { port: 5187 },
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
  },
});
