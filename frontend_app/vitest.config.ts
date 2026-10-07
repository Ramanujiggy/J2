import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Scope to src/ only. The Playwright specs under playwright/ also match
    // vitest's default `**/*.spec.ts` glob, and collecting them crashes the
    // run ("Playwright Test did not expect test.describe() to be called here").
    // They are run by `playwright.config.ts`, not here.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
