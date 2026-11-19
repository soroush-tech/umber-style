// What the gate gates, and how it runs the suite. The one place to change either. Node runs this file
// directly (`bin/gate.mjs`), so it imports types only.
import type { GateConfig } from './gate'

/**
 * The threshold, and which cases are gated: a case whose id starts with a `gated` prefix and with no
 * `reportOnly` prefix. Everything else is measured and reported and never fails the gate.
 */
export const GATE_CONFIG: GateConfig = {
  threshold: 0.8,
  gated: ['core/', 'react/'],
  // Measured and shown, never failed on: operations of a few nanoseconds to a microsecond and a case
  // that sets up a large theme, whose figure changes from one process to the next by up to a half
  // with the same code (docs/benchmarks.md, "The gate").
  reportOnly: ['core/helpers', 'core/sheets', 'core/tokens > nested partial themes'],
}

/**
 * How each round runs the suite: the files `pnpm bench` is given (the files left out are the slow
 * option sweep, the one-pass start-up checks and the memory figures, which are not compared) and the
 * environment both sides get, so that base and head are measured alike whatever each side's own defaults are.
 */
export const GATE_SUITE = {
  files: [
    'classes.bench',
    'tokens.bench',
    'helpers.bench',
    'pruning.bench',
    'extraction.bench',
    'sheets.bench',
    'string.bench',
    'dom.bench',
    'tree.server.bench',
    'render.bench',
    'styles.bench',
  ],
  env: { BENCH_TIME: '200' },
}
