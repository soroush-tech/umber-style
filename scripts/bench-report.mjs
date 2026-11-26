// node scripts/bench-report.mjs plan <name>@<version> ... [--summary <file>] [--output <file>]
// node scripts/bench-report.mjs append <name>@<version> <report file> [--summary <file>]
// The parts of the benchmark report after a release that soroush-tech/bench-action does not do. The
// action runs the scenarios of bench/report/ in the soroush-bench sandbox and writes the report (the ratio
// of every case against the baseline, worked out by soroush-bench); cd-packages.yml runs this script
// before it and after it. It is a report, not a gate, and nothing here fails a release.
//
//   plan    for the package just published that has scenarios: waits until npm lists the version, picks
//           the versions to compare (planReport in bench/src/releases.ts), writes them into
//           bench/report/versions.json, and with --output writes `spec=` and `baseline-case=` (the version
//           every ratio is against) for the action. A package with nothing to compare (a first release)
//           gets a line and no outputs, so the action does not run.
//   append  puts the report file (the `report` output of the action) after the notes of the GitHub Release
//           `<name>@<version>`, in place of a report a run before put there (needs `gh` and GH_TOKEN).
//
//   --summary <file>  also append the lines this script prints to this file (the job summary)
//   --output <file>   plan only: where the outputs go (the step's $GITHUB_OUTPUT)
//
// Exit code 0 on success; 1 when the registry never listed a version that has scenarios, or the Release
// could not be edited.
import { spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
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
/** Where a report is put in the notes of a Release, so that a run again replaces it. */
const MARKER = '<!-- umber-style benchmark report -->'

const root = fileURLToPath(new URL('..', import.meta.url))

const args = process.argv.slice(2)
const readOption = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args.splice(index, 2)[1]
}
const summaryFile = readOption('--summary')
const outputFile = readOption('--output')
const [command, ...rest] = args

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

/** The `plan` command: the versions file and the outputs for the action, for the one spec that has scenarios. */
async function plan(specs) {
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
    const { compared, baseline } = planReport(available, version)
    if (baseline === undefined) {
      say(
        `\`${spec}\`: no earlier release to compare with (a first release), so there is no report.`
      )
      continue
    }
    // Oldest first, then the one just published: the cases of every report file.
    const versions = [...compared.map(({ version: each }) => each), version]
    writeFileSync(
      join(root, folder, 'versions.json'),
      `${JSON.stringify({ package: name, versions })}\n`
    )
    const roles = compared
      .map(
        ({ version: each, role }) =>
          `${each} (${each === baseline ? `${role}, the baseline` : role})`
      )
      .join(' and ')
    say(`\`${spec}\`: compared with ${roles}, every version installed from npm.`)
    if (outputFile !== undefined) {
      appendFileSync(outputFile, `spec=${spec}\nbaseline-case=${baseline}\n`)
    }
  }
}

/** The `append` command: puts the report after the notes of the GitHub Release `tag`, in place of the one a run before put there. */
function append(tag, reportFile) {
  const report = readFileSync(reportFile, 'utf8').trim()
  const view = spawnSync('gh', ['release', 'view', tag, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  })
  if (view.status !== 0) {
    say(`No GitHub Release \`${tag}\` to add the report to.`)
    return
  }
  const notes = view.stdout.split(MARKER)[0].trimEnd()
  const file = join(tmpdir(), 'bench-report-notes.md')
  writeFileSync(file, `${notes}\n\n${MARKER}\n\n${report}\n`)
  if (
    spawnSync('gh', ['release', 'edit', tag, '--notes-file', file], { stdio: 'inherit' }).status !==
    0
  ) {
    say(`The report could not be added to the GitHub Release \`${tag}\`.`)
    isFailed = true
  }
}

if (command === 'plan') await plan(rest)
else if (command === 'append' && rest.length === 2) append(rest[0], rest[1])
else {
  console.error(
    'Usage: bench-report.mjs plan <name>@<version> ... | append <name>@<version> <report file>'
  )
  isFailed = true
}

if (summaryFile !== undefined && output.length > 0) {
  appendFileSync(summaryFile, `${output.join('\n')}\n`)
}
process.exitCode = isFailed ? 1 : 0
