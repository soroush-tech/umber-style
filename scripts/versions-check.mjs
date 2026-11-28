// The pure part of scripts/check-versions.mjs: whether the publishable packages carry one version,
// whether CORE_VERSION names it, and whether the siblings are declared the way the standard says.
// No file, no process: the CLI reads the manifests and the source.

const CORE_MARKER = "export const CORE_VERSION = '"

/**
 * The version `CORE_VERSION` is set to in the text of sharedState.ts: what sits between the quotes
 * after its declaration. `undefined` when the declaration is not there, or its string is not closed.
 */
export function readCoreVersion(source) {
  const start = source.indexOf(CORE_MARKER)
  if (start === -1) return undefined
  const from = start + CORE_MARKER.length
  const end = source.indexOf("'", from)
  return end === -1 ? undefined : source.slice(from, end)
}

/** The packages whose `private` is not true, as the manifests give them. */
export function selectPublishable(manifests) {
  return manifests.filter((manifest) => manifest.private !== true)
}

/** One line when the packages carry more than one version: each version with the packages that have it. */
function findSplitVersions(packages) {
  const byVersion = new Map()
  for (const { name, version } of packages) {
    byVersion.set(version, [...(byVersion.get(version) ?? []), name])
  }
  if (byVersion.size < 2) return []
  const groups = [...byVersion].map(([version, names]) => `${version} (${names.join(', ')})`)
  return [`The packages carry different versions: ${groups.join('; ')}`]
}

/** One line when CORE_VERSION is missing, or is not the version of every package. */
function findCoreMismatch(packages, coreVersion) {
  if (coreVersion === undefined)
    return ['CORE_VERSION is not declared in packages/core/src/sharedState.ts']
  const versions = [...new Set(packages.map(({ version }) => version))]
  if (versions.every((version) => version === coreVersion)) return []
  return [
    `CORE_VERSION is ${coreVersion} in packages/core/src/sharedState.ts, the packages carry ${versions.join(', ')}`,
  ]
}

/** The form a sibling must be declared in, for each kind of dependency (packages/packages.md). */
const EXPECTED_RANGE = [
  ['dependencies', 'workspace:^'],
  ['peerDependencies', 'workspace:^'],
  ['devDependencies', 'workspace:*'],
]

/** One line for each sibling declared in another form than its kind of dependency takes. */
function findWrongRanges(packages) {
  const siblings = new Set(packages.map(({ name }) => name))
  const lines = []
  for (const pkg of packages) {
    for (const [field, expected] of EXPECTED_RANGE) {
      for (const [dependency, range] of Object.entries(pkg[field] ?? {})) {
        if (siblings.has(dependency) && range !== expected)
          lines.push(`${pkg.name} declares ${dependency} as ${range} in ${field}, not ${expected}`)
      }
    }
  }
  return lines
}

/**
 * Every problem with the versions of the family, one line each; empty when there is none.
 * `manifests` are the parsed package.json files of the folders under packages/, private ones too.
 */
export function findVersionProblems(manifests, coreSource) {
  const packages = selectPublishable(manifests)
  return [
    ...findSplitVersions(packages),
    ...findCoreMismatch(packages, readCoreVersion(coreSource)),
    ...findWrongRanges(packages),
  ]
}
