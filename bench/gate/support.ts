// What the gate files and the report files share: the shape of a scenario, the case that builds a
// scenario's operation for one build of the core, and the gate config, whose two sides are builds of
// the core loaded by path in the same way.
import type { BenchCase, BenchContext } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import { PREVIOUS_DIR } from './baseline'

/** The API of the core that a scenario uses: the source's, which every build is read as. */
export type CoreModule = typeof Core

/** One scenario: the label of its config, and what makes its operation from one build of the core. */
export interface Scenario {
  name: string
  /** Makes the cache, the inputs and any warm-up for one side, and returns the operation that is timed. */
  build: (core: CoreModule) => () => unknown
}

/**
 * A case of `scenario` that makes its operation the first time it runs, from the module that `select`
 * gives then: each side makes its own cache and inputs, and nothing is shared between them.
 */
export function createSide(
  scenario: Scenario,
  select: (context: BenchContext) => CoreModule
): BenchCase {
  let run: (() => unknown) | undefined
  return (context) => {
    run ??= scenario.build(select(context))
    return run()
  }
}

const load = createRequire(import.meta.url)

/**
 * The build of the core at `path` (relative to the root of the repository), loaded with `require` as an
 * app loads the published package. Throws with what to run when it is not there, so that a file fails
 * before it measures anything.
 */
function loadBuild(path: string, remedy: string): CoreModule {
  try {
    return load(`../../${path}`) as CoreModule
  } catch (error) {
    throw new Error(`${path} could not be loaded: ${remedy}.`, { cause: error })
  }
}

/**
 * The gate config of `scenario`: `current` runs the built core of this tree (`pnpm build`), `previous`
 * the build of the last release that `bench/bin/previous.mjs` made in `PREVIOUS_DIR`. Both builds are
 * loaded when the file is.
 */
export function createGate(scenario: Scenario) {
  const current = loadBuild('packages/core/dist/index.cjs', 'run pnpm build')
  const previous = loadBuild(
    `${PREVIOUS_DIR}/packages/core/dist/index.cjs`,
    'run node bench/bin/previous.mjs'
  )
  return {
    name: scenario.name,
    cases: {
      current: createSide(scenario, () => current),
      previous: createSide(scenario, () => previous),
    },
  }
}
