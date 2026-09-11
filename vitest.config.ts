import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    // *.bun.test.ts imports bun:test and runs under `bun test` (see test:storage).
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/**/*.bun.test.ts'],
    setupFiles: ['apps/web/src/setupTests.ts'],
  },
});
