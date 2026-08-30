import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e/**', '.idea', '.git', '.cache'],
    // All rules suites share the same Firestore/Storage emulators. Running
    // rule files in parallel lets one suite initialize or clean up the shared
    // Storage ruleset while another suite is still evaluating requests.
    fileParallelism: false,
  },
});
