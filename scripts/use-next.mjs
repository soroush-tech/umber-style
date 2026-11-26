// Pins `next` across the whole workspace to one version, in this checkout only (never committed), so the
// App Router fixture runs on another Next.js 16 than the lockfile's: CI's Next.js axis does it through
// .github/actions/setup, and a machine can do it by hand.
//
//   node scripts/use-next.mjs <16.N | 16.N.M>   pin the newest stable 16.N.x on npm, or that version
//   pnpm install --no-frozen-lockfile           install it (the lockfile no longer matches)
//   node scripts/use-next.mjs --check           every member that resolves next has it
//
// The pin is a root `pnpm.overrides`, so every member that depends on `next` (the fixtures, the React
// binding's dev dependency) resolves the same copy. Undo it with `git checkout package.json
// pnpm-lock.yaml` and `pnpm install --frozen-lockfile`.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnpinnedNext, pickNextVersion, pinNext, readPinnedNext } from './next-pin.mjs'

const REGISTRY = 'https://registry.npmjs.org'
const root = fileURLToPath(new URL('..', import.meta.url))
const manifestFile = join(root, 'package.json')
const [spec] = process.argv.slice(2)

const fail = (message) => {
  console.error(`::error::${message}`)
  process.exit(1)
}

const readManifest = () => JSON.parse(readFileSync(manifestFile, 'utf8'))

// Every version of `next` on npm, from its abbreviated document.
const fetchVersions = async () => {
  const response = await fetch(`${REGISTRY}/next`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) fail(`The npm registry answered ${response.status} for next`)
  return Object.keys((await response.json()).versions)
}

// The version of `next` that the member at `path` resolves, or undefined when it resolves none.
const readInstalled = (path) => {
  try {
    return createRequire(join(path, 'package.json'))('next/package.json').version
  } catch {
    return undefined
  }
}

const check = () => {
  const version = readPinnedNext(readManifest())
  // A fixed command with no argument from outside: one string, so Windows can run it through its shell.
  const listing = spawnSync('pnpm ls -r --depth -1 --json', {
    cwd: root,
    shell: true,
    encoding: 'utf8',
  })
  if (listing.status !== 0) fail(`pnpm ls failed: ${listing.stderr}`)
  const installed = JSON.parse(listing.stdout)
    .map(({ name: member, path }) => ({ member, version: readInstalled(path) }))
    .filter((copy) => copy.version !== undefined)
  const problems = findUnpinnedNext(installed, version)
  if (problems.length > 0) fail(problems.join('\n'))
  console.log(`${installed.length} copies of next in the workspace, all ${version}`)
}

const pin = async () => {
  const version = pickNextVersion(spec, await fetchVersions())
  writeFileSync(manifestFile, `${JSON.stringify(pinNext(readManifest(), version), null, 2)}\n`)
  console.log(`next ${version} pinned across the workspace (${spec})`)
}

try {
  if (spec === '--check') check()
  else await pin()
} catch (error) {
  fail(error.message)
}
