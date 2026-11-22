// Fails when the types of the React binding cost the type checker more than a budget, on the shapes of a
// design system that costs it most (packages/react/type-cost/designSystem.tsx).
//
//   node scripts/check-type-cost.mjs
//
// It compiles two programs with the TypeScript of @umber-style/react, `--extendedDiagnostics` and
// `--singleThreaded` (with several checkers, a type that two files need is counted once in each, and
// how the files are shared out moves the total): the design system, and `engineOnly.ts`, which
// imports the same modules of the engine and does nothing with them. The difference of their
// instantiations is the cost of the design system's shapes, without the engine's own source. A count
// of instantiations is the same on every run for one version of TypeScript and of @types/react, where
// a time is not. `pnpm typecheck` of @umber-style/react runs it.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const reactDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'react')
// About 20% over the 136,522 that TypeScript 7.0.2 with @types/react 19.3.0 counts. The form of the
// props before it counted 175,941. Set it again, the same way, when either is upgraded.
const INSTANTIATION_BUDGET = 164_000

/** The path of the `tsc` of @umber-style/react. */
const findTsc = () => {
  const requireFromReact = createRequire(join(reactDir, 'package.json'))
  return join(dirname(requireFromReact.resolve('typescript/package.json')), 'bin', 'tsc')
}

/** The instantiations and types that the checker counts for the program of `project`. */
const measureProgram = (tsc, project) => {
  const run = spawnSync(
    process.execPath,
    [tsc, '-p', join(reactDir, 'type-cost', project), '--extendedDiagnostics', '--singleThreaded'],
    { encoding: 'utf8' }
  )
  if (run.status !== 0) {
    process.stdout.write(run.stdout)
    process.stderr.write(run.stderr)
    throw new Error(`${project} does not compile`)
  }
  const readCount = (label) => Number(new RegExp(`^${label}:\\s+(\\d+)`, 'm').exec(run.stdout)?.[1])
  return { instantiations: readCount('Instantiations'), types: readCount('Types') }
}

const tsc = findTsc()
const program = measureProgram(tsc, 'tsconfig.json')
const engine = measureProgram(tsc, 'tsconfig.engine.json')
const instantiations = program.instantiations - engine.instantiations
const types = program.types - engine.types
console.log(
  `type cost of the design system: ${instantiations} instantiations (budget ${INSTANTIATION_BUDGET}), ${types} types`
)
if (!(instantiations <= INSTANTIATION_BUDGET)) {
  console.error(
    'The types cost the checker more than the budget: see "How the cost of the types is kept" in docs/typed-styles.md.'
  )
  process.exit(1)
}
