// The pure part of scripts/use-next.mjs: which Next.js to pin, how the root manifest pins it, and
// whether what was installed is the pinned version. No file, no network: the CLI does those.

/**
 * The version of `next` that `spec` names among the versions npm lists: an exact version (`16.0.11`) as
 * it is, a minor (`16.0`) as its newest stable patch. Throws when `spec` is neither, or npm has no such
 * version.
 */
export function pickNextVersion(spec, versions) {
  const isExact = /^\d+\.\d+\.\d+$/.test(spec)
  if (!isExact && !/^\d+\.\d+$/.test(spec))
    throw new Error(
      `Expected a Next.js minor such as 16.0 or a version such as 16.0.11, got "${spec}"`
    )
  const [newest] = versions
    .filter((version) =>
      isExact ? version === spec : version.startsWith(`${spec}.`) && !version.includes('-')
    )
    .sort((a, b) => Number(b.split('.')[2]) - Number(a.split('.')[2]))
  if (!newest) throw new Error(`npm has no next ${spec}`)
  return newest
}

/** The root manifest with `next` pinned to `version` by `pnpm.overrides`, the rest kept. */
export function pinNext(manifest, version) {
  const { pnpm = {} } = manifest
  return { ...manifest, pnpm: { ...pnpm, overrides: { ...pnpm.overrides, next: version } } }
}

/** The version the root manifest pins `next` to. Throws when it pins none. */
export function readPinnedNext(manifest) {
  const next = manifest.pnpm?.overrides?.next
  if (!next)
    throw new Error('package.json pins no Next.js: run node scripts/use-next.mjs <version> first')
  return next
}

/**
 * What is wrong with the installed copies of `next` (`{ member, version }`, one for each workspace member
 * that resolves it) against the pinned `version`: one line for each copy of another version, or one line
 * when no member resolves it. Empty when every copy is it.
 */
export function findUnpinnedNext(installed, version) {
  if (installed.length === 0) return ['No workspace member resolves next']
  return installed
    .filter((copy) => copy.version !== version)
    .map(({ member, version: found }) => `${member} resolves next ${found}, not ${version}`)
}
