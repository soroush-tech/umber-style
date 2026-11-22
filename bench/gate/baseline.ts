// What the gate compares the current tree with: the build of the last release of the core, made from its
// git tag in a folder inside the repository. `bench/bin/previous.mjs` reads these to make that build, and
// `support.ts` loads it from there.

/** The package whose release tags the gate chooses from (a release is tagged `<name>@<version>`). */
export const BASELINE_PACKAGE = '@umber-style/core'

/**
 * Which release is the baseline: `'stable'`, the last stable tag; `'newest'`, the newest tag, stable or
 * release candidate. Alphas have no tag.
 */
export const BASELINE_RELEASE: 'stable' | 'newest' = 'stable'

/**
 * The folder, relative to the root of the repository, where the release is checked out and built. It is
 * inside the repository because the sandbox mounts only the repository; git and every tool ignore it.
 */
export const PREVIOUS_DIR = '.bench-previous'
