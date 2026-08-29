import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e/**', '.idea', '.git', '.cache'],
  },
});
