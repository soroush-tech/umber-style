// node scripts/bench-report.mjs <name>@<version> ... [--rounds <n>] [--summary <file>] [--release]
// The benchmark report after a release: for each package just published that has scenarios, the
// scenarios of bench/report/ run in the Docker sandbox of soroush-bench with every version installed
// from npm, and one table says how long each version takes and how fast it is against the last stable.
// cd-packages.yml runs it after a publish; it is a report, not a gate, and nothing here fails a release.
//
// Which versions are compared is planReport in bench/src/releases.ts. The times and the ratios are
// soroush-bench's own: the median of `--rounds` rounds (5 by default) from the table it writes with
// --md-file, and the ratio its gate prints for each case against --baseline-case. The gate is given a
// target no case can reach, so that it prints the ratio of every case; its exit code is therefore not
// read, and a file counts as run when its table and every ratio came back.
//
//   --summary <file>  also append the markdown to this file (the job summary)
//   --release         also append each package's table to its GitHub Release `<name>@<version>`, after
//                     the notes and in place of a table a run before put there (needs `gh` and GH_TOKEN)
//
// Exit code 0 when every package with scenarios got its table, or had nothing to compare (a first
// release); 1 when a run or the registry failed.
import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planReport } from '../bench/src/releases.ts'

/** The packages that have report scenarios, and the folder of their report files. */
const SCENARIOS = { '@umber-style/core': 'bench/report' }
const REGISTRY = 'https://registry.npmjs.org'
/** How long to wait for the registry to list a version it was just given: 30 tries, 10 seconds apart. */
const REGISTRY_TRIES = 30
const REGISTRY_DELAY = 10_000
/** A speed no case reaches, in percent: the gate then prints the ratio of every case. */
const UNREACHABLE_RATIO = '1000000000'
/** How the table of soroush-bench writes microseconds: with the micro sign, which the report writes as us. */
const MICRO_SECONDS = `${String.fromCodePoint(0xb5)}s`
/** Where a table is put in the notes of a Release, so that a run again replaces it. */
const MARKER = '<!-- umber-style benchmark report -->'

const root = fileURLToPath(new URL('..', import.meta.url))
const tool = join(root, 'bench/node_modules/@soroush.tech/bench')
const cli = join(
  tool,
  JSON.parse(readFileSync(join(tool, 'package.json'), 'utf8')).bin['soroush-bench']
)

const args = process.argv.slice(2)
const readOption = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const rounds = readOption('--rounds') ?? '5'
const summaryFile = readOption('--summary')
const releaseIndex = args.indexOf('--release')
const hasRelease = releaseIndex !== -1
if (hasRelease) args.splice(releaseIndex, 1)
const specs = args

const output = []
const say = (text) => {
  output.push(text)
  console.log(text)
}
let isFailed = false

/** Every version of `name` on npm, once `version` is among them; undefined when it never came. */
async function waitForVersions(name, version) {
  for (let attempt = 1; attempt <= REGISTRY_TRIES; attempt++) {
    try {
      const response = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
        signal: AbortSignal.timeout(15_000),
      })
      if (response.ok) {
        const versions = Object.keys((await response.json()).versions ?? {})
        if (versions.includes(version)) return versions
      }
    } catch {
      // A network error is one more try.
    }
    if (attempt < REGISTRY_TRIES)
      await new Promise((resolve) => setTimeout(resolve, REGISTRY_DELAY))
  }
  return undefined
}

/** The markdown table that soroush-bench wrote: the name of the file's config, and the mean time of one operation by case key. */
function readTable(file) {
  let name = file
  const times = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim())
    if (cells.length < 4 || !cells[1].includes('::')) continue
    const split = cells[1].lastIndexOf('::')
    name = cells[1].slice(0, split).trim()
    times.set(cells[1].slice(split + 2).trim(), cells[2].replaceAll(MICRO_SECONDS, 'us'))
  }
  return { name, times }
}

/** The ratios that the gate of soroush-bench printed, by case key: `<label> - <n>% of baseline speed`. */
function readRatios(text) {
  const ratios = new Map()
  for (const match of text.matchAll(/^\s+.*::\s*(.+?) - ([\d.]+)% of baseline speed\r?$/gm)) {
    ratios.set(match[1], `${match[2]}%`)
  }
  return ratios
}

/** Runs one report file and returns its row, or undefined when it did not come back whole. */
function runFile(file, plan, outDir) {
  const tableFile = join(outDir, `${file.replace(/\W/g, '_')}.md`)
  rmSync(tableFile, { force: true })
  const result = spawnSync(
    process.execPath,
    [
      cli,
      file,
      '--rounds',
      rounds,
      '--mount',
      `${outDir}:/out`,
      '--md-file',
      `/out/${file.replace(/\W/g, '_')}.md`,
      '--baseline-case',
      plan.baseline,
      '--min-ratio',
      UNREACHABLE_RATIO,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'inherit', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  process.stderr.write(result.stderr ?? '')
  if (!existsSync(tableFile)) return undefined
  const { name, times } = readTable(tableFile)
  const ratios = readRatios(result.stderr ?? '')
  const cells = plan.versions.map(({ version }) => {
    const time = times.get(version)
    if (version === plan.baseline) return time
    const ratio = ratios.get(version)
    return time === undefined || ratio === undefined ? undefined : `${time} (${ratio})`
  })
  if (cells.includes(undefined)) return undefined
  return { name, cells }
}

/** The markdown of one package's report. */
function formatReport(spec, plan, rows) {
  const head = plan.versions.map(({ version, role }) => `${version} (${role})`)
  return [
    `### Benchmarks: \`${spec}\``,
    '',
    `Each row is one scenario of \`bench/report/\`, the median of ${rounds} rounds in the soroush-bench sandbox (one CPU, 512 MB), every version installed from npm. A cell is the mean time of one operation and, in brackets, the speed against ${plan.baseline}: above 100% is faster.`,
    '',
    `| Scenario | ${head.join(' | ')} |`,
    `| --- | ${head.map(() => '---:').join(' | ')} |`,
    ...rows.map(({ name, cells }) => `| ${name} | ${cells.join(' | ')} |`),
  ].join('\n')
}

/** Puts `table` after the notes of the GitHub Release `tag`, in place of the table a run before put there. */
function appendToRelease(tag, table) {
  const view = spawnSync('gh', ['release', 'view', tag, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  })
  if (view.status !== 0) {
    say(`No GitHub Release \`${tag}\` to add the table to.`)
    return
  }
  const notes = view.stdout.split(MARKER)[0].trimEnd()
  const file = join(tmpdir(), 'bench-report-notes.md')
  writeFileSync(file, `${notes}\n\n${MARKER}\n\n${table}\n`)
  if (
    spawnSync('gh', ['release', 'edit', tag, '--notes-file', file], { stdio: 'inherit' }).status !==
    0
  ) {
    say(`The table could not be added to the GitHub Release \`${tag}\`.`)
    isFailed = true
  }
}

for (const spec of specs) {
  const at = spec.lastIndexOf('@')
  const name = spec.slice(0, at)
  const version = spec.slice(at + 1)
  const folder = SCENARIOS[name]
  if (folder === undefined) {
    say(
      `\`${spec}\`: no benchmark report (only ${Object.keys(SCENARIOS).join(', ')} has report scenarios).`
    )
    continue
  }
  const available = await waitForVersions(name, version)
  if (available === undefined) {
    say(
      `\`${spec}\`: the registry did not list it after ${REGISTRY_TRIES} tries, so there is no report.`
    )
    isFailed = true
    continue
  }
  const { published, compared, baseline } = planReport(available, version)
  if (baseline === undefined) {
    say(`\`${spec}\`: no earlier release to compare with (a first release), so there is no report.`)
    continue
  }
  // The columns of the table: the versions compared, oldest first, then the one just published.
  const plan = { baseline, versions: [...compared, { version: published, role: 'published' }] }
  writeFileSync(
    join(root, folder, 'versions.json'),
    `${JSON.stringify({ package: name, versions: plan.versions.map(({ version: each }) => each) })}\n`
  )
  // Writable by the sandbox's own user, whose id is not the runner's.
  const outDir = mkdtempSync(join(tmpdir(), 'bench-report-'))
  chmodSync(outDir, 0o777)
  const files = readdirSync(join(root, folder))
    .filter((file) => file.endsWith('.bench.ts'))
    .sort()
    .map((file) => `${folder}/${file}`)
  const rows = []
  const missing = []
  for (const file of files) {
    console.log(`\n=== ${file} ===`)
    const row = runFile(file, plan, outDir)
    if (row === undefined) missing.push(file)
    else rows.push(row)
  }
  rmSync(outDir, { recursive: true, force: true })
  const table = formatReport(spec, plan, rows)
  say(`\n${table}`)
  if (missing.length > 0) {
    say(`\nThese files did not run to the end, so they have no row: ${missing.join(', ')}.`)
    isFailed = true
  }
  if (hasRelease && rows.length > 0) appendToRelease(spec, table)
}

if (summaryFile !== undefined) appendFileSync(summaryFile, `${output.join('\n')}\n`)
process.exitCode = isFailed ? 1 : 0
