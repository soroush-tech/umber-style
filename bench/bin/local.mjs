// pnpm bench [filter ...] [soroush-bench option ...]
// Runs every soroush-bench file of packages/*/bench/ in the Docker sandbox, one after the other (two at
// once would measure each other), from the repository root, which soroush-bench mounts. The files load
// the built `dist` of each package, so `pnpm bench` builds before it calls this script.
//
//   pnpm bench                  every file
//   pnpm bench core             the files of one package (core, css, react, vue or react-native)
//   pnpm bench classes          the files whose name has "classes" in it
//   pnpm bench react string     a package and a part of a file name together
//   pnpm bench --rounds 5 --md  options go to soroush-bench as they are, for every file
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '')
const tool = new URL('../node_modules/@soroush.tech/bench/', import.meta.url)
const cli = fileURLToPath(
  new URL(
    JSON.parse(readFileSync(new URL('package.json', tool), 'utf8')).bin['soroush-bench'],
    tool
  )
)

const filters = []
const options = []
const args = process.argv.slice(2).filter((value) => value !== '--')
for (let index = 0; index < args.length; index++) {
  const value = args[index]
  if (!value.startsWith('--')) filters.push(value)
  else {
    options.push(value)
    if (VALUE_OPTIONS.has(value) && index + 1 < args.length) options.push(args[++index])
  }
}

// pnpm links `node_modules` with absolute paths (junctions on Windows), which resolve in the sandbox
// only when the repository is also mounted at the path they point to. Docker Desktop on Windows sees
// a drive `C:\` as `/mnt/host/c`.
const linked =
  process.platform === 'win32'
    ? `/mnt/host/${root[0].toLowerCase()}${root.slice(2).replaceAll('\\', '/')}`
    : root
const mount = ['--mount', `${root}:${linked}:ro`]

const files = readdirSync(join(root, 'packages'))
  .filter((name) => existsSync(join(root, 'packages', name, 'bench')))
  .flatMap((name) =>
    readdirSync(join(root, 'packages', name, 'bench'))
      .filter((file) => file.endsWith('.bench.ts'))
      .filter((file) => filters.every((filter) => filter === name || file.includes(filter)))
      .map((file) => `packages/${name}/bench/${file}`)
  )
  .sort()

if (files.length === 0) {
  console.error(`No benchmark file matches ${filters.join(' ')}.`)
  process.exit(1)
}
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker is not running: soroush-bench runs each file in a Docker sandbox.')
  process.exit(1)
}

const failed = []
for (const file of files) {
  console.log(`\n=== ${file} ===`)
  const { status } = spawnSync(process.execPath, [cli, file, ...mount, ...options], {
    cwd: root,
    stdio: 'inherit',
  })
  if (status !== 0) failed.push(file)
}
if (failed.length > 0) {
  console.error(`\nThese benchmark files failed:\n${failed.join('\n')}`)
  process.exitCode = 1
}
