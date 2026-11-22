// The one place that says which published release the gate compares against.
//
// `latest`: the stable release of each package on npm (0.1.0 was the first).
export const BASELINE_TAG = 'latest'

/** The install specs the gate files give to `packages` (the sandbox installs them under `previous`). */
export const previousCore = `@umber-style/core@${BASELINE_TAG}`
