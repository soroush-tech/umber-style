// Fails when the publishable packages do not carry one version: the guard of issue #85. Run it with
// `pnpm check:versions`; the pre-commit hook, the lint job of CI and cd-packages.yml (before
// anything is published) run it. The decisions are in versions-check.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findVersionProblems, selectPublishable } from './versions-check.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = join(repoRoot, 'packages')

/** The parsed package.json of every folder under packages/ that has one. */
const manifests = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name, 'package.json'))
  .filter((file) => existsSync(file))
  .map((file) => JSON.parse(readFileSync(file, 'utf8')))

const coreSource = readFileSync(join(packagesDir, 'core', 'src', 'sharedState.ts'), 'utf8')
const problems = findVersionProblems(manifests, coreSource)

if (problems.length > 0) {
  console.error('The publishable packages do not agree on their versions:')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('\nSee packages/packages.md: one version for the family, siblings as workspace:^.')
  process.exit(1)
}

console.log(`${selectPublishable(manifests).length} publishable packages carry one version.`)
