import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest does not run through Next.js, so it does not pick up .env files.
 *
 * `.env.local` is deliberately NOT read here: on a Vercel-linked checkout it
 * holds the *production* connection string, and integration tests write to the
 * database. Tests read `.env.test` then `.env` (the local instance), and an
 * explicit environment variable still wins over both, which is how CI points
 * them at its own service container.
 */
function loadDotEnv() {
  for (const file of ['.env.test', '.env']) {
    let contents: string;
    try {
      contents = readFileSync(new URL(file, import.meta.url), 'utf8');
    } catch {
      continue;
    }
    for (const line of contents.split('\n')) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue = ''] = match;
      if (process.env[key] !== undefined) continue;
      const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Integration specs need a live DATABASE_URL and skip themselves without
    // one, so the same command works with or without a database.
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
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
