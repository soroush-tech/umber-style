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
  /** A hash of the token options (modes, raw and length keys, registered tokens, always-declared paths). */
  tokens: string
}

/** The short code each option has in the stamp, in the order they are written. */
const CODES: readonly (readonly [string, keyof FingerprintOptions])[] = [
  ['p', 'prefix'],
  ['x', 'suffix'],
  ['l', 'hasLabels'],
  ['y', 'hasLayers'],
  ['r', 'hasPruning'],
  ['b', 'hasBaseClass'],
  ['s', 'hasScope'],
  ['f', 'hasColorFallbacks'],
  ['t', 'tokens'],
]

/** The text of one option in the stamp: a flag is 1 or 0, a string is encoded. */
function toStampValue(value: string | boolean): string {
  return typeof value === 'boolean' ? (value ? '1' : '0') : encodeURIComponent(value)
}

/** The stamp of `options`, short enough for an attribute: `p=umber;x=;l=1;y=1;...`. */
export function createFingerprint(options: FingerprintOptions): string {
  return CODES.map(([code, name]) => `${code}=${toStampValue(options[name])}`).join(';')
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
  const differences = CODES.filter(([code]) => theirs.get(code) !== ours.get(code)).map(
    ([code, name]) =>
      `${name} (server: ${decodeURIComponent(theirs.get(code) ?? '')}, browser: ${decodeURIComponent(ours.get(code) as string)})`
  )
  if (differences.length === 0) return ''
  return `UmberStyle: the server rendered this page with other options than the browser uses. Differing options: ${differences.join('; ')}. Create the style with the same options on both sides.`
}
