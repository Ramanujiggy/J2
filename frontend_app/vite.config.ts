import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // proxy API calls to the backend so CORS is not an issue in dev
    proxy: {
      '/auth': 'http://localhost:5000',
      '/api':  'http://localhost:5000',
    },
  },
});
