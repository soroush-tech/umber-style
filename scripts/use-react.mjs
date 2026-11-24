// Pins `react` and `react-dom` across the whole workspace to one version, in this checkout only (never
// committed), so the suite runs on another React 19 than the lockfile's: CI's React matrix does it
// through .github/actions/setup, and a machine can do it by hand.
//
//   node scripts/use-react.mjs <19.N | 19.N.M>   pin the newest stable 19.N.x on npm, or that version
//   pnpm install --no-frozen-lockfile            install it (the lockfile no longer matches)
//   node scripts/use-react.mjs --check           every member that resolves react or react-dom has it
//
// The pin is a root `pnpm.overrides`, so every dependent (Next.js, the testing libraries, the bindings'
// dev dependencies) resolves the same copy. Undo it with `git checkout package.json pnpm-lock.yaml`
// and `pnpm install --frozen-lockfile`.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnpinned, pickReactVersion, pinReact, readPinnedReact } from './react-pin.mjs'

const REGISTRY = 'https://registry.npmjs.org'
const root = fileURLToPath(new URL('..', import.meta.url))
const manifestFile = join(root, 'package.json')
const [spec] = process.argv.slice(2)

const fail = (message) => {
  console.error(`::error::${message}`)
  process.exit(1)
}

const readManifest = () => JSON.parse(readFileSync(manifestFile, 'utf8'))

// Every version of a package on npm, from its abbreviated document.
const fetchVersions = async (name) => {
  const response = await fetch(`${REGISTRY}/${name}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) fail(`The npm registry answered ${response.status} for ${name}`)
  return Object.keys((await response.json()).versions)
}

// The version of `name` that the member at `path` resolves, or undefined when it resolves none.
const readInstalled = (path, name) => {
  try {
    return createRequire(join(path, 'package.json'))(`${name}/package.json`).version
  } catch {
    return undefined
  }
}

const check = () => {
  const version = readPinnedReact(readManifest())
  // A fixed command with no argument from outside: one string, so Windows can run it through its shell.
  const listing = spawnSync('pnpm ls -r --depth -1 --json', {
    cwd: root,
    shell: true,
    encoding: 'utf8',
  })
  if (listing.status !== 0) fail(`pnpm ls failed: ${listing.stderr}`)
  const installed = JSON.parse(listing.stdout).flatMap(({ name: member, path }) =>
    ['react', 'react-dom']
      .map((name) => ({ member, name, version: readInstalled(path, name) }))
      .filter((copy) => copy.version !== undefined)
  )
  const problems = findUnpinned(installed, version)
  if (problems.length > 0) fail(problems.join('\n'))
  console.log(`${installed.length} copies of react and react-dom in the workspace, all ${version}`)
}

const pin = async () => {
  const [reactVersions, reactDomVersions] = await Promise.all([
    fetchVersions('react'),
    fetchVersions('react-dom'),
  ])
  const version = pickReactVersion(spec, reactVersions, reactDomVersions)
  writeFileSync(manifestFile, `${JSON.stringify(pinReact(readManifest(), version), null, 2)}\n`)
  console.log(`react and react-dom ${version} pinned across the workspace (${spec})`)
}

try {
  if (spec === '--check') check()
  else await pin()
} catch (error) {
  fail(error.message)
}
