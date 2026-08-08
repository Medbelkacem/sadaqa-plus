import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Password hashing is deliberately slow (32 MiB scrypt); give those specs
    // room rather than lowering the cost factor for tests.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/validations/**', 'src/lib/**'],
      exclude: ['**/*.d.ts'],
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // `server-only` throws outside a React Server Component graph. Unit tests
      // exercise those modules directly, so the guard is stubbed out here — it
      // still protects the real bundle.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
      },
    ],
  },
});
