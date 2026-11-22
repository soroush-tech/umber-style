// What the report files share: the versions to compare, which `scripts/bench-report.mjs` writes into
// `versions.json` next to this file before it runs them, and the report config of a scenario, whose
// cases are those versions installed from npm in the sandbox.
import type { BenchConfig } from '@soroush.tech/bench'
import { readFileSync } from 'node:fs'
import { createSide, type CoreModule, type Scenario } from '../gate/support'

/** What `versions.json` holds: the package, and its versions oldest first. */
export interface ReportVersions {
  package: string
  versions: string[]
}

/** The alias a version is installed under in the sandbox: a package name of its own, so that the versions sit side by side. */
export const toAlias = (version: string): string => `v${version}`

/** The versions to compare: the file that the report script wrote. Throws with what to run when there is none. */
function readVersions(): ReportVersions {
  try {
    return JSON.parse(readFileSync(new URL('versions.json', import.meta.url), 'utf8'))
  } catch (error) {
    throw new Error(
      'bench/report/versions.json could not be read: run node scripts/bench-report.mjs <name>@<version>.',
      { cause: error }
    )
  }
}

/**
 * The report config of `scenario`: one case for each version of `versions.json`, named by the version,
 * each installed from npm under its alias and given to the case by soroush-bench.
 */
export function createReport(scenario: Scenario): BenchConfig {
  const { package: name, versions } = readVersions()
  return {
    name: scenario.name,
    packages: Object.fromEntries(
      versions.map((version) => [toAlias(version), `${name}@${version}`])
    ),
    cases: Object.fromEntries(
      versions.map((version) => [
        version,
        createSide(scenario, ({ modules }) => modules[toAlias(version)] as CoreModule),
      ])
    ),
  }
}
