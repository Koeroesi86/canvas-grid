import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['benchmarks/**/*.bench.ts'],
    testTimeout: 0,
    reporters: ['dot'],
    // lets the memory benchmark collect garbage before reading the heap
    execArgv: ['--expose-gc'],
  },
});
