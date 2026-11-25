// node scripts/bench-report.mjs <name>@<version> ... [--rounds <n>] [--summary <file>] [--release]
// The benchmark report after a release: for each package just published that has scenarios, the
// scenarios of bench/report/ run in the Docker sandbox of soroush-bench with every version installed
// from npm, and one table says how long each version takes and how fast it is against the last stable.
// cd-packages.yml runs it after a publish; it is a report, not a gate, and nothing here fails a release.
//
// Which versions are compared is planReport in bench/src/releases.ts. The times are soroush-bench's own:
// the median of `--rounds` rounds (5 by default) of each case, from the raw numbers it writes with
// --json-file. The ratio is the one its gate checks, baseline.avg / version.avg, worked out from those
// numbers by createReportRow (bench/src/reportTable.ts), which also lays out the table. No gate runs, so a
// file counts as run when soroush-bench exits with 0 and its JSON has every version.
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
import { createColumns, createReportRow, formatReport } from '../bench/src/reportTable.ts'

/** The packages that have report scenarios, and the folder of their report files. */
const SCENARIOS = { '@umber-style/core': 'bench/report' }
const REGISTRY = 'https://registry.npmjs.org'
/** How long to wait for the registry to list a version it was just given: 30 tries, 10 seconds apart. */
const REGISTRY_TRIES = 30
const REGISTRY_DELAY = 10_000
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

/** Runs one report file and returns its row, or undefined when it did not run to the end or a version is missing from it. */
function runFile(file, columns, outDir) {
  const name = `${file.replace(/\W/g, '_')}.json`
  const jsonFile = join(outDir, name)
  rmSync(jsonFile, { force: true })
  const { status } = spawnSync(
    process.execPath,
    [cli, file, '--rounds', rounds, '--mount', `${outDir}:/out`, '--json-file', `/out/${name}`],
    { cwd: root, stdio: 'inherit' }
  )
  if (status !== 0 || !existsSync(jsonFile)) return undefined
  return createReportRow(JSON.parse(readFileSync(jsonFile, 'utf8')), columns)
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
  // The columns of the table: the versions compared, oldest first, then the one just published.
  const columns = createColumns(planReport(available, version))
  if (columns === undefined) {
    say(`\`${spec}\`: no earlier release to compare with (a first release), so there is no report.`)
    continue
  }
  writeFileSync(
    join(root, folder, 'versions.json'),
    `${JSON.stringify({ package: name, versions: columns.versions.map(({ version: each }) => each) })}\n`
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
    const row = runFile(file, columns, outDir)
    if (row === undefined) missing.push(file)
    else rows.push(row)
  }
  rmSync(outDir, { recursive: true, force: true })
  const table = formatReport(spec, columns, rows, rounds)
  say(`\n${table}`)
  if (missing.length > 0) {
    say(`\nThese files did not run to the end, so they have no row: ${missing.join(', ')}.`)
    isFailed = true
  }
  if (hasRelease && rows.length > 0) appendToRelease(spec, table)
}

if (summaryFile !== undefined) appendFileSync(summaryFile, `${output.join('\n')}\n`)
process.exitCode = isFailed ? 1 : 0
