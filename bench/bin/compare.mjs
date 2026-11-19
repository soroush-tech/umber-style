// pnpm bench:compare <a.json> <b.json> [lower [upper]]
// The logic is in ../src/compare.ts, which has its tests. Node runs the TypeScript file directly.
import { readFileSync } from 'node:fs'

const { runCompare } = await import('../src/compare.ts')

process.exitCode = runCompare(
  process.argv.slice(2),
  (path) => readFileSync(path, 'utf8'),
  (line) => console.log(line)
)
