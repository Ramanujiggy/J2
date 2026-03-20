import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      JWT_SECRET: 'test-secret-for-vitest',
      NODE_ENV: 'test',
    },
  },
});
