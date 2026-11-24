// The pure part of scripts/use-react.mjs: which React to pin, how the root manifest pins it, and
// whether what was installed is the pinned version. No file, no network: the CLI does those.

/**
 * The version that `spec` names among the versions npm lists for `react` and for `react-dom`: an
 * exact version (`19.0.9`) as it is, a minor (`19.0`) as its newest stable patch. Both packages must
 * have it, because they are pinned together. Throws when `spec` is neither, or npm has no such version.
 */
export function pickReactVersion(spec, reactVersions, reactDomVersions) {
  const isExact = /^\d+\.\d+\.\d+$/.test(spec)
  if (!isExact && !/^\d+\.\d+$/.test(spec))
    throw new Error(
      `Expected a React minor such as 19.0 or a version such as 19.0.9, got "${spec}"`
    )
  const candidates = isExact
    ? [spec]
    : reactVersions.filter((version) => version.startsWith(`${spec}.`) && !version.includes('-'))
  const [newest] = candidates
    .filter((version) => reactVersions.includes(version) && reactDomVersions.includes(version))
    .sort((a, b) => Number(b.split('.')[2]) - Number(a.split('.')[2]))
  if (!newest) throw new Error(`npm has no react and react-dom ${spec}`)
  return newest
}

/** The root manifest with `react` and `react-dom` pinned to `version` by `pnpm.overrides`, the rest kept. */
export function pinReact(manifest, version) {
  const { pnpm = {} } = manifest
  return {
    ...manifest,
    pnpm: { ...pnpm, overrides: { ...pnpm.overrides, react: version, 'react-dom': version } },
  }
}

/** The version the root manifest pins `react` and `react-dom` to. Throws when it pins none, or two. */
export function readPinnedReact(manifest) {
  const { react, 'react-dom': reactDom } = manifest.pnpm?.overrides ?? {}
  if (!react || react !== reactDom)
    throw new Error('package.json pins no React: run node scripts/use-react.mjs <version> first')
  return react
}

/**
 * What is wrong with the installed copies of `react` and `react-dom` (`{ member, name, version }`, one
 * for each workspace member that resolves the package) against the pinned `version`: one line for each
 * copy of another version, or one line when no member resolves either. Empty when every copy is it.
 */
export function findUnpinned(installed, version) {
  if (installed.length === 0) return ['No workspace member resolves react or react-dom']
  return installed
    .filter((copy) => copy.version !== version)
    .map(
      ({ member, name, version: found }) => `${member} resolves ${name} ${found}, not ${version}`
    )
}
