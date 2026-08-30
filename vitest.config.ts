import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      'apps/functions/src/**/*.test.{ts,tsx}',
      'apps/functions/src/**/__tests__/**/*.{ts,tsx}'
    ],
    exclude: ['node_modules', 'dist', 'e2e/**', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/**',
        'apps/functions/src/**'
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/*.d.ts'
      ],
      // Keep the coverage gate above the current repository baseline while
      // the remaining untested services are covered incrementally.
      thresholds: {
        lines: 45,
        functions: 45,
        branches: 45,
        statements: 45,
      },
    },
  },
});
