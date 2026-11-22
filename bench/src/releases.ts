// Which released versions a benchmark compares: the tag of the last release that the gate builds, and
// the versions that the report after a release puts side by side. Pure functions of lists of versions
// and tags, so that the scripts that read git and the registry (`bench/bin/previous.mjs`,
// `scripts/bench-report.mjs`) keep no rule of their own.

/** A version split into its parts: `0.3.0-rc.1` is 0, 3, 0 and `['rc', 1]`. */
export interface Version {
  major: number
  minor: number
  patch: number
  /** The dot-separated identifiers after the hyphen: numbers where they are numeric. Empty for a stable version. */
  prerelease: Array<string | number>
  /** The version as it was written. */
  text: string
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

/** The parts of `text`, or undefined when it is not a version (`latest`, `1.0`, `v1.0.0`). */
export function parseVersion(text: string): Version | undefined {
  const match = VERSION_PATTERN.exec(text)
  if (match === null) return undefined
  const [, major, minor, patch, prerelease] = match
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease:
      prerelease === undefined
        ? []
        : prerelease.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
    text,
  }
}

/** Compares two prerelease identifiers: numbers by value and before words, words by code unit. */
function compareIdentifiers(first: string | number, second: string | number): number {
  if (typeof first === 'number' && typeof second === 'number') return first - second
  if (typeof first === 'number') return -1
  if (typeof second === 'number') return 1
  if (first === second) return 0
  return first < second ? -1 : 1
}

/** Negative when `first` comes before `second`, positive after, 0 when they are the same version (semantic versioning's order). */
export function compareVersions(first: Version, second: Version): number {
  const core =
    first.major - second.major || first.minor - second.minor || first.patch - second.patch
  if (core !== 0) return core
  // A stable version comes after every prerelease of it.
  if (first.prerelease.length === 0 || second.prerelease.length === 0) {
    return second.prerelease.length - first.prerelease.length
  }
  const length = Math.min(first.prerelease.length, second.prerelease.length)
  for (let index = 0; index < length; index++) {
    const order = compareIdentifiers(first.prerelease[index], second.prerelease[index])
    if (order !== 0) return order
  }
  return first.prerelease.length - second.prerelease.length
}

/** Whether `version` is `0.0.0` or a prerelease of it: published only to hold a name, never a baseline. */
export function isPlaceholder(version: Version): boolean {
  return version.major === 0 && version.minor === 0 && version.patch === 0
}

/** Whether two versions have the same major, minor and patch. */
function isSameTarget(first: Version, second: Version): boolean {
  return (
    first.major === second.major && first.minor === second.minor && first.patch === second.patch
  )
}

/** The newest of `versions`, or undefined when there is none. */
function findNewest(versions: readonly Version[]): Version | undefined {
  return versions.reduce<Version | undefined>(
    (newest, version) =>
      newest === undefined || compareVersions(version, newest) > 0 ? version : newest,
    undefined
  )
}

/**
 * Which release the gate compares with: `stable` is the last stable release, `newest` the newest
 * release, stable or release candidate. Alphas have no tag, so they are never one.
 */
export type BaselineRelease = 'stable' | 'newest'

/**
 * The tag of the release of `name` that the gate builds, out of the tags of the repository (a release
 * is tagged `<name>@<version>`): the newest that `release` allows. Tags of other packages, tags that are
 * not a version and placeholders are skipped. Undefined when no tag is left.
 */
export function pickBaselineTag(
  tags: readonly string[],
  name: string,
  release: BaselineRelease
): string | undefined {
  const start = `${name}@`
  const versions = tags
    .filter((tag) => tag.startsWith(start))
    .map((tag) => parseVersion(tag.slice(start.length)))
    .filter((version): version is Version => version !== undefined && !isPlaceholder(version))
    .filter(
      (version) =>
        version.prerelease.length === 0 || (release === 'newest' && version.prerelease[0] === 'rc')
    )
  const newest = findNewest(versions)
  return newest === undefined ? undefined : `${start}${newest.text}`
}

/**
 * Why a version is in a release report: the last stable, or the previous release of the published
 * version's channel (`previous rc`, `previous alpha`).
 */
export type ReportRole = 'last stable' | `previous ${string}`

/** One version a release report compares with the published one. */
export interface ReportVersion {
  version: string
  role: ReportRole
}

/** What a release report compares. */
export interface ReportPlan {
  /** The version just published. */
  published: string
  /** The versions it is compared with, oldest first; empty when there is nothing to compare. */
  compared: ReportVersion[]
  /** The version the ratios are against: the last stable, else the previous release of the channel; undefined when `compared` is empty. */
  baseline: string | undefined
}

/**
 * The versions that the report after a release of `published` compares it with, out of the versions the
 * registry lists for the package (in any order, with or without `published`):
 *
 * - the last stable: the highest stable version below `published` (`0.2.0` for `0.3.0` and for every
 *   `0.3.0-*`), which every ratio is against;
 * - for an alpha or a release candidate, the previous release of the same channel of the same version:
 *   the highest that exists below it (`0.3.0-rc.2` for `0.3.0-rc.3`, or `0.3.0-rc.1` when `rc.2` was
 *   never published). Never another channel: `0.3.0-rc.0` is not compared with an alpha of `0.3.0`.
 *
 * A stable release is compared with the last stable only. A placeholder (`0.0.0`, `0.0.0-stage`) is
 * never compared. With neither, `compared` is empty: the first release of a package, or the first
 * prerelease of a package that has no stable, has nothing to compare. Throws when `published` is not a
 * version.
 */
export function planReport(available: readonly string[], published: string): ReportPlan {
  const target = parseVersion(published)
  if (target === undefined) throw new Error(`"${published}" is not a version.`)
  const older = available
    .map(parseVersion)
    .filter(
      (version): version is Version =>
        version !== undefined && !isPlaceholder(version) && compareVersions(version, target) < 0
    )
  const lastStable = findNewest(older.filter((version) => version.prerelease.length === 0))
  const channel = target.prerelease[0]
  const previous =
    channel === undefined
      ? undefined
      : findNewest(
          older.filter(
            (version) => isSameTarget(version, target) && version.prerelease[0] === channel
          )
        )
  const compared: ReportVersion[] = []
  if (lastStable !== undefined) compared.push({ version: lastStable.text, role: 'last stable' })
  if (previous !== undefined) {
    compared.push({ version: previous.text, role: `previous ${channel}` })
  }
  return { published: target.text, compared, baseline: (lastStable ?? previous)?.text }
}
