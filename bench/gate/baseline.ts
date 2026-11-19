// The one place that says which published release the gate compares against.
//
// `alpha` for now: `latest` is an empty placeholder until the first stable release. After that release,
// change this one line to 'latest'.
export const BASELINE_TAG = 'alpha'

/** The install specs the gate files give to `packages` (the sandbox installs them under `previous`). */
export const previousCore = `@umber-style/core@${BASELINE_TAG}`
