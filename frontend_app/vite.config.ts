import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Move Vite's cache out of node_modules — prevents EBUSY errors on Railway
  // where the node_modules/.vite path can be held by a layer cache lock.
  cacheDir: '.vite-cache',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      // injectManifest strategy lets us ship a hand-written `src/sw.ts` that
      // adds Web Push handlers (push + notificationclick) on top of the
      // Workbox-managed precaching/runtime caching the plugin still injects.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    // proxy API calls to the backend so CORS is not an issue in dev
    proxy: {
      '/auth': 'http://localhost:5000',
      '/api':  'http://localhost:5000',
    },
  },
});
