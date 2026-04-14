import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'forks',
    maxConcurrency: 1,
    minWorkers: 1,
    maxWorkers: 1,
    bail: 1, // Stop after first test file failure
  },
});
