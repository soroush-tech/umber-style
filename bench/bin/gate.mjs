// pnpm bench:gate [--ref <git ref>] [filter ...] [soroush-bench option ...]
// Runs the benchmark gate on your machine as the `bench` job of .github/workflows/ci.yml runs it: the
// build of the last release is made first (bench/bin/previous.mjs, which `--ref` goes to), then every
// file of bench/gate/ runs in the Docker sandbox of soroush-bench, one after the other, with the job's
// baseline case, minimum ratio and rounds. `pnpm bench:gate` builds this tree before it calls this script.
//
//   pnpm bench:gate                       every gate file, against the last release
//   pnpm bench:gate class                 the gate files whose name has "class" in it
//   pnpm bench:gate --ref HEAD            against a second build of the last commit
//   pnpm bench:gate --rounds 1            options go to soroush-bench after the job's own, so they win
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** What the `bench` job of ci.yml gives soroush-tech/bench-action: keep the two the same. */
const JOB_OPTIONS = ['--baseline-case', 'previous', '--min-ratio', '80', '--rounds', '5']

/** The options of soroush-bench that take a value: the word after them is not a filter. */
const VALUE_OPTIONS = new Set([
  '--cpus',
  '--cpu',
  '--cpuset',
  '--memory',
  '--tag',
  '--mount',
  '--md-file',
  '--rounds',
  '--baseline-case',
  '--min-ratio',
])

const root = fileURLToPath(new URL('../..', import.meta.url))
const tool = new URL('../node_modules/@soroush.tech/bench/', import.meta.url)
const cli = fileURLToPath(
  new URL(
    JSON.parse(readFileSync(new URL('package.json', tool), 'utf8')).bin['soroush-bench'],
    tool
  )
)

const filters = []
const options = []
const previousArgs = []
const args = process.argv.slice(2).filter((value) => value !== '--')
for (let index = 0; index < args.length; index++) {
  const value = args[index]
  if (value === '--ref') previousArgs.push(value, args[++index])
  else if (!value.startsWith('--')) filters.push(value)
  else {
    options.push(value)
    if (VALUE_OPTIONS.has(value) && index + 1 < args.length) options.push(args[++index])
  }
}

const files = readdirSync(join(root, 'bench/gate'))
  .filter((file) => file.endsWith('.bench.ts'))
  .filter((file) => filters.every((filter) => file.includes(filter)))
  .map((file) => `bench/gate/${file}`)
  .sort()

if (files.length === 0) {
  console.error(`No gate file matches ${filters.join(' ')}.`)
  process.exit(1)
}
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker is not running: soroush-bench runs each file in a Docker sandbox.')
  process.exit(1)
}

const prepared = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('previous.mjs', import.meta.url)), ...previousArgs],
  { cwd: root, stdio: 'inherit' }
)
if (prepared.status !== 0) process.exit(1)

const failed = []
for (const file of files) {
  console.log(`\n=== ${file} ===`)
  const { status } = spawnSync(process.execPath, [cli, file, ...JOB_OPTIONS, ...options], {
    cwd: root,
    stdio: 'inherit',
  })
  if (status !== 0) failed.push(file)
}
if (failed.length > 0) {
  console.error(`\nThese gate files failed:\n${failed.join('\n')}`)
  process.exitCode = 1
}
