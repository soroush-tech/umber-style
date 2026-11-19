import { defineConfig } from 'vitest/config'

// The benchmarks: `pnpm bench` at the repository root runs them, one file after the other. They are
// not tests: `pnpm test` and the coverage run never see this folder.
export default defineConfig({
  test: {
    globals: true,
    // What a shipped build runs: Vue and the engine take their production paths.
    env: { NODE_ENV: 'production' },
    environment: 'node',
    // Two files at once would measure each other.
    fileParallelism: false,
    testTimeout: 1_800_000,
    // So that the memory figures can force a collection.
    execArgv: ['--expose-gc'],
    // The warning that module exports are read through getters is switched off: it is true of every
    // file (see docs/benchmarks.md, "What the figures include").
    benchmark: { include: ['bench/**/*.bench.ts'], suppressExportGetterWarnings: true },
  },
})
