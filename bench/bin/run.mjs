// pnpm bench [package ...] [file filter ...]
// Runs the benchmarks of each package one after the other (never two at once: they would disturb each
// other's timings), collects what each benchmark file wrote, and prints and writes the combined result.
//
//   pnpm bench                 every package
//   pnpm bench core            one package (core, react, vue or react-native)
//   pnpm bench tokens          the benchmark files whose path has "tokens" in it, in every package
//   pnpm bench react options   a package and a file filter together
//
// Environment: BENCH_TIME (ms each case is measured for, default 200), BENCH_WARMUP (ms of warm-up,
// default a quarter of the time), BENCH_OUT_DIR (where the results go, default bench/results).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { combineResults, createResult, formatMarkdown, formatMemory, formatTable } =
  await import('../src/report.ts')

const PACKAGES = ['core', 'react', 'vue', 'react-native']
const root = fileURLToPath(new URL('../..', import.meta.url))
const outDir = process.env.BENCH_OUT_DIR ?? join(root, 'bench', 'results')
const partsDir = join(outDir, 'parts')

const filters = process.argv.slice(2).filter((value) => value !== '--')
const named = filters.filter((value) => PACKAGES.includes(value))
const selected = named.length > 0 ? PACKAGES.filter((name) => named.includes(name)) : PACKAGES
const fileFilters = filters.filter((value) => !PACKAGES.includes(value))

const environment = {
  node: process.version,
  vitest: JSON.parse(
    readFileSync(join(root, 'packages', 'core', 'node_modules', 'vitest', 'package.json'), 'utf8')
  ).version,
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  time: Number(process.env.BENCH_TIME ?? 200),
}

mkdirSync(partsDir, { recursive: true })
const results = []
let failed = false

for (const name of selected) {
  for (const file of readdirSync(partsDir)) {
    if (file.startsWith(`${name}--`)) rmSync(join(partsDir, file))
  }
  console.log(`\n=== ${name} ===`)
  // One command line for the shell: pnpm is a script on Windows, which only a shell starts.
  const command = [
    'pnpm exec vitest bench --run --reporter=verbose --config vitest.bench.config.ts --passWithNoTests',
    ...fileFilters,
  ].join(' ')
  const { status } = spawnSync(command, {
    cwd: join(root, 'packages', name),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, BENCH_PACKAGE: name, BENCH_PARTS_DIR: partsDir },
  })
  if (status !== 0) failed = true
  const parts = readdirSync(partsDir)
    .filter((file) => file.startsWith(`${name}--`))
    .map((file) => JSON.parse(readFileSync(join(partsDir, file), 'utf8')))
  const result = createResult(name, parts, environment, new Date().toISOString())
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(result, null, 2))
  results.push(result)
}

const all = combineResults(results, environment, new Date().toISOString())
writeFileSync(join(outDir, 'all.json'), JSON.stringify(all, null, 2))
writeFileSync(join(outDir, 'report.md'), formatMarkdown(all))

console.log('\n=== All results ===\n')
console.log(formatTable(all.cases))
if (all.memory.length > 0) {
  console.log('\n=== Memory (reported, not compared) ===\n')
  console.log(formatMemory(all.memory))
}
console.log(`\nWrote ${join(outDir, 'all.json')} and ${join(outDir, 'report.md')}`)
if (failed) {
  console.error('\nA benchmark run failed: see the output above.')
  process.exitCode = 1
}
