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
      // Without this, the SW only registers on production builds — meaning
      // pushManager.subscribe() (and any code awaiting navigator.serviceWorker.ready)
      // hangs forever in `npm run dev`. `type: 'module'` is required so the
      // TS-source SW can use ES module imports during dev.
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor chunks — browsers cache these across deploys until
          // the library version changes, cutting repeat-visit bundle download.
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-gsap':   ['gsap'],
        },
      },
    },
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
