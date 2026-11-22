// node bench/bin/previous.mjs [--ref <git ref>]
// Makes the `previous` side of the benchmark gate: the core of the last release, checked out from its git
// tag into a folder inside the repository (the sandbox mounts only the repository) and built there with
// that release's own lockfile and tooling. The tag is the newest `@umber-style/core@<version>` that
// `BASELINE_RELEASE` in bench/gate/baseline.ts allows; `--ref` builds another commit instead (a tag, a
// branch, a commit id, `HEAD`). CI runs it before the gate; `pnpm bench:gate` runs it on your machine.
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASELINE_PACKAGE, BASELINE_RELEASE, PREVIOUS_DIR } from '../gate/baseline.ts'
import { pickBaselineTag } from '../src/releases.ts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const target = join(root, PREVIOUS_DIR)
const marker = join(target, '.previous.json')

const fail = (message) => {
  console.error(`::error::${message}`)
  process.exit(1)
}

/** Runs a command in `cwd` and returns its output; stops the script when it fails. pnpm prints as it goes. */
const run = (command, args, cwd = root) => {
  const isPnpm = command === 'pnpm'
  const options = {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', isPnpm ? 'inherit' : 'pipe', 'inherit'],
  }
  // pnpm is a `.cmd` file on Windows, which only a shell runs: it gets one line (the arguments here are
  // this script's own, with no space or quote in them).
  const result =
    isPnpm && process.platform === 'win32'
      ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
      : spawnSync(command, args, options)
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed (exit code ${result.status})`)
  return (result.stdout ?? '').trim()
}

/** Whether a command succeeds, its output unread. */
const succeeds = (command, args) =>
  spawnSync(command, args, { cwd: root, stdio: 'ignore' }).status === 0

// The public address of the repository, read from the core's package.json: anonymous, so that it works
// in CI with no credentials and on a machine whose remote is reached over SSH.
const remote = JSON.parse(
  readFileSync(join(root, 'packages/core/package.json'), 'utf8')
).repository.url.replace(/^git\+/, '')

const refIndex = process.argv.indexOf('--ref')
const givenRef = refIndex === -1 ? undefined : process.argv[refIndex + 1]

/** The commit id of the tag or ref to build, and the name it is shown by. */
function resolveSource() {
  if (givenRef !== undefined) {
    if (succeeds('git', ['rev-parse', '--verify', '--quiet', `${givenRef}^{commit}`])) {
      return { name: givenRef, commit: run('git', ['rev-parse', `${givenRef}^{commit}`]) }
    }
    fetchRef(givenRef)
    return { name: givenRef, commit: run('git', ['rev-parse', 'FETCH_HEAD^{commit}']) }
  }
  // `<id>\trefs/tags/<tag>`, and `<id>\trefs/tags/<tag>^{}` for the commit of an annotated tag.
  const commits = new Map()
  for (const line of run('git', ['ls-remote', '--tags', remote, `refs/tags/${BASELINE_PACKAGE}@*`])
    .split('\n')
    .filter(Boolean)) {
    const [id, ref] = line.split('\t')
    const tag = ref.slice('refs/tags/'.length).replace(/\^\{\}$/, '')
    if (ref.endsWith('^{}') || !commits.has(tag)) commits.set(tag, id)
  }
  const tag = pickBaselineTag([...commits.keys()], BASELINE_PACKAGE, BASELINE_RELEASE)
  if (tag === undefined) {
    fail(
      `${remote} has no ${BASELINE_RELEASE} release tag of ${BASELINE_PACKAGE}: the gate has nothing to compare with.`
    )
  }
  const commit = commits.get(tag)
  if (!succeeds('git', ['cat-file', '-e', `${commit}^{commit}`])) fetchRef(`refs/tags/${tag}`)
  return { name: tag, commit }
}

/** Fetches `ref` from the public address, into FETCH_HEAD only: no tag or branch of the clone changes. */
function fetchRef(ref) {
  // A shallow clone (CI's) takes the one commit; a full clone takes its history, so it stays full.
  const isShallow = run('git', ['rev-parse', '--is-shallow-repository']) === 'true'
  run('git', ['fetch', '--no-tags', ...(isShallow ? ['--depth=1'] : []), remote, ref])
}

const source = resolveSource()
const built = join(target, 'packages/core/dist/index.cjs')
if (existsSync(marker) && existsSync(built)) {
  const previous = JSON.parse(readFileSync(marker, 'utf8'))
  if (previous.commit === source.commit) {
    console.log(`previous: ${source.name} (${source.commit}), built already in ${PREVIOUS_DIR}`)
    process.exit(0)
  }
}

// The tree of the commit, as git stores it: no worktree, so nothing in the clone's own state changes.
// The archive is read by a relative path, which every tar takes (one in Git for Windows reads
// `C:\...` as a remote host).
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
run('git', ['archive', '--format=tar', '-o', join(target, 'source.tar'), source.commit])
run('tar', ['-xf', 'source.tar'], target)
rmSync(join(target, 'source.tar'))

// The core and what it needs to build, as that release's lockfile pins them: the build is the one that
// release made. --ignore-scripts, as every install in CI.
run(
  'pnpm',
  ['install', '--frozen-lockfile', '--ignore-scripts', '--filter', `${BASELINE_PACKAGE}...`],
  target
)
run('pnpm', ['--filter', BASELINE_PACKAGE, 'build'], target)
if (!existsSync(built)) fail(`The build of ${source.name} has no ${built}.`)
writeFileSync(marker, `${JSON.stringify(source)}\n`)

console.log(`previous: ${source.name} (${source.commit}), built in ${PREVIOUS_DIR}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `The benchmark gate compares this tree with \`${source.name}\` (${source.commit}).\n`
  )
}
