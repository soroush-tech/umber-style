import { defineConfig } from 'vitest/config'

// The benchmarks: `pnpm bench` at the repository root runs them, one file after the other. They are
// not tests: `pnpm test` and the coverage run never see this folder.
export default defineConfig({
  // The production JSX runtime, to match the production React that NODE_ENV selects below.
  oxc: { jsx: { development: false } },
  test: {
    globals: true,
    // What a shipped build runs: React and the engine take their production paths.
    env: { NODE_ENV: 'production' },
    // Two files at once would measure each other.
    fileParallelism: false,
    testTimeout: 1_800_000,
    // So that the memory figures can force a collection.
    execArgv: ['--expose-gc'],
    projects: [
      {
        // The client build. A file that needs the DOM says so with `@vitest-environment jsdom`.
        extends: true,
        test: {
          name: 'client',
          environment: 'node',
          // The warning that module exports are read through getters is switched off: it is true of
          // every file (see docs/benchmarks.md, "What the figures include").
          benchmark: {
            include: ['bench/**/*.bench.tsx'],
            exclude: ['bench/**/*.server.bench.tsx'],
            suppressExportGetterWarnings: true,
          },
        },
      },
      {
        // The server components build, with the `react-server` condition, as the server tests run it.
        extends: true,
        resolve: { conditions: ['react-server'] },
        ssr: { resolve: { conditions: ['react-server'], externalConditions: ['react-server'] } },
        test: {
          name: 'server',
          environment: 'node',
          server: { deps: { inline: [/react/] } },
          benchmark: {
            include: ['bench/**/*.server.bench.tsx'],
            suppressExportGetterWarnings: true,
          },
        },
      },
    ],
  },
})
