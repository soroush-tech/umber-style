/** The options of a cache that change the CSS it writes or the classes it names: the server and the browser must agree on all of them. */
export interface FingerprintOptions {
  prefix: string
  suffix: string
  hasLabels: boolean
  hasLayers: boolean
  hasPruning: boolean
  hasBaseClass: boolean
  hasScope: boolean
  hasColorFallbacks: boolean
  hasValueRepair: boolean
  /** A hash of the token options (modes, raw and length keys, registered tokens, always-declared paths). */
  tokens: string
}

/**
 * The short code each option has in the stamp, in the order they are written. An option added later has
 * a third entry, the value it is left out with: the stamp of a page that does not turn it on stays the
 * same text as before, and a stamp that lacks it reads as that value.
 */
const CODES: readonly (readonly [string, keyof FingerprintOptions, string?])[] = [
  ['p', 'prefix'],
  ['x', 'suffix'],
  ['l', 'hasLabels'],
  ['y', 'hasLayers'],
  ['r', 'hasPruning'],
  ['b', 'hasBaseClass'],
  ['s', 'hasScope'],
  ['f', 'hasColorFallbacks'],
  ['v', 'hasValueRepair', '0'],
  ['t', 'tokens'],
]

/** The text of one option in the stamp: a flag is 1 or 0, a string is encoded. */
function toStampValue(value: string | boolean): string {
  if (typeof value !== 'boolean') return encodeURIComponent(value)
  return value ? '1' : '0'
}

/** The stamp of `options`, short enough for an attribute: `p=umber;x=;l=1;y=1;...`. */
export function createFingerprint(options: FingerprintOptions): string {
  return CODES.flatMap(([code, name, omitted]) => {
    const value = toStampValue(options[name])
    return value === omitted ? [] : [`${code}=${value}`]
  }).join(';')
}

/** The values of a stamp, by short code. */
function parseFingerprint(stamp: string): Map<string, string> {
  return new Map(
    stamp.split(';').map((part) => {
      const at = part.indexOf('=')
      return [part.slice(0, at), part.slice(at + 1)] as const
    })
  )
}

/** The message that says which options differ between the stamp of the server and that of the browser, or '' when none. */
export function describeFingerprintDifferences(server: string, browser: string): string {
  const theirs = parseFingerprint(server)
  const ours = parseFingerprint(browser)
  const differences = CODES.filter(
    ([code, , omitted]) => (theirs.get(code) ?? omitted) !== (ours.get(code) ?? omitted)
  ).map(
    ([code, name, omitted]) =>
      `${name} (server: ${decodeURIComponent(theirs.get(code) ?? omitted ?? '')}, browser: ${decodeURIComponent((ours.get(code) ?? omitted) as string)})`
  )
  if (differences.length === 0) return ''
  return `UmberStyle: the server rendered this page with other options than the browser uses. Differing options: ${differences.join('; ')}. Create the style with the same options on both sides.`
}
