// What every gate file shares: the two cases of a scenario, built so that each side has its own state.
import type { BenchCase, BenchContext } from '@soroush.tech/bench'

/**
 * The `local` and `previous` cases of one scenario. `build` makes one side's operation from that side's
 * module, the first time the case runs: so each side makes its own engine, cache and inputs, and nothing
 * is shared between them.
 */
export function createSides<M>(
  local: M,
  build: (api: M) => () => unknown
): Record<'local' | 'previous', BenchCase> {
  const side = (select: (context: BenchContext) => M): BenchCase => {
    let run: (() => unknown) | undefined
    return (context) => {
      if (run === undefined) run = build(select(context))
      return run()
    }
  }
  return {
    local: side(() => local),
    previous: side((context) => context.modules.previous as M),
  }
}
