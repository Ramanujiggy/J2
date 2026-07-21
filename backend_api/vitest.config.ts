import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      JWT_SECRET: 'test-secret-for-vitest',
      NODE_ENV: 'test',
      // Stub R2 credentials so r2Client.ts (mig 028) loads at import time
      // without throwing. Tests mock the actual SDK calls — these values are
      // never used to talk to a real bucket.
      R2_ACCOUNT_ID: 'test-account-id',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      R2_BUCKET_NAME: 'test-bucket',
      R2_ENDPOINT: 'https://test-account-id.r2.cloudflarestorage.com',
    },
  },
});
