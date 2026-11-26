import { createCache } from './cache'

// A real content security policy in Chromium: the page of this file is given `style-src 'nonce-allowed'`
// once (a policy cannot be taken back), so every style element made after it without that nonce is
// refused, and has no sheet as soon as it is in the document. Its scripts have a nonce of their own
// (`script-src 'nonce-AAA'`), as a page that gives scripts and styles different nonces.

const NONCE = 'allowed'
const SCRIPT_NONCE = 'AAA'

beforeAll(() => {
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = `script-src 'self' 'nonce-${SCRIPT_NONCE}'; style-src 'nonce-${NONCE}'`
  document.head.append(meta)
})

afterEach(() => {
  for (const element of document.head.querySelectorAll('style, script[nonce]')) element.remove()
  vi.restoreAllMocks()
})

/** The messages about the policy that `console.warn` was given while `write` ran. */
function readPolicyWarnings(write: () => void): unknown[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  write()
  const messages = warn.mock.calls.map(([message]) => message)
  warn.mockRestore()
  return messages.filter((message) => String(message).includes('policy'))
}

/** The style elements of the cache of `prefix`, and whether the policy let each in (it has a sheet). */
const readElements = (prefix: string) =>
  [...document.head.querySelectorAll<HTMLStyleElement>(`style[data-style="${prefix}"]`)].map(
    (element) => ({ nonce: element.nonce, isApplied: element.sheet !== null })
  )

describe('the element of a cache under a policy with a nonce', () => {
  it('is refused with no nonce anywhere, as soon as it is in the document, and the checks say so once', () => {
    // Injected with a nonce the policy does not allow: refused, so it is no source of the page's nonce.
    const forged = document.createElement('style')
    forged.setAttribute('nonce', 'forged')
    document.head.append(forged)
    expect(forged.sheet).toBeNull()
    const cache = createCache({ prefix: 'pa', hasDevChecks: true })
    const warnings = readPolicyWarnings(() => {
      cache.css({ color: 'red' })
      cache.css({ color: 'blue' })
    })
    expect(readElements('pa').every(({ isApplied }) => !isApplied)).toBe(true)
    expect(warnings).toEqual([
      '[pa] The policy of this page refused a style element: no nonce was found on the page. Give one with createCache({ nonce }), or with setNonceSource for server components.',
    ])
  })

  it("is refused with a nonce given to the cache that is not the page's, and the checks say so once, in either way of writing", () => {
    for (const speedy of [false, true]) {
      const prefix = speedy ? 'pr' : 'pb'
      const cache = createCache({ prefix, nonce: 'wrong', hasDevChecks: true, speedy })
      const warnings = readPolicyWarnings(() => {
        cache.css({ color: 'red' })
        cache.css({ color: 'blue' })
      })
      expect(readElements(prefix)[0]).toEqual({ nonce: 'wrong', isApplied: false })
      expect(warnings).toEqual([
        `[${prefix}] The policy of this page refused a style element with the nonce given to the cache: it is not the nonce of this page. Give the cache the nonce of the request that sent the page.`,
      ])
    }
  })

  it('is allowed with the nonce of the page, given or read from an element the page let in, and nothing is said', () => {
    const given = readPolicyWarnings(() =>
      createCache({ prefix: 'pc', nonce: NONCE, hasDevChecks: true }).css({ color: 'red' })
    )
    expect(readElements('pc').length).toBeGreaterThan(0)
    expect(readElements('pc')).toEqual(
      readElements('pc').map(() => ({ nonce: NONCE, isApplied: true }))
    )
    const applied = document.createElement('style')
    applied.setAttribute('nonce', NONCE)
    document.head.append(applied)
    const read = readPolicyWarnings(() =>
      createCache({ prefix: 'pd', hasDevChecks: true }).css({ color: 'red' })
    )
    expect(readElements('pd').length).toBeGreaterThan(0)
    expect(readElements('pd')).toEqual(
      readElements('pd').map(() => ({ nonce: NONCE, isApplied: true }))
    )
    expect([...given, ...read]).toEqual([])
  })

  it('is refused with the nonce of a script of the page when it gives its scripts and styles different nonces, and the checks say so once', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', SCRIPT_NONCE)
    document.head.append(script)
    const cache = createCache({ prefix: 'pf', hasDevChecks: true })
    const warnings = readPolicyWarnings(() => {
      cache.css({ color: 'red' })
      cache.css({ color: 'blue' })
    })
    expect(readElements('pf')[0]).toEqual({ nonce: SCRIPT_NONCE, isApplied: false })
    expect(warnings).toEqual([
      '[pf] The policy of this page refused a style element with the nonce of a script of the page: the page may give its scripts and its styles different nonces. Give the style nonce with createCache({ nonce }), or with setNonceSource for server components.',
    ])
  })

  it('takes the nonce of a style element the page let in over that of a script, and nothing is said', () => {
    const script = document.createElement('script')
    script.setAttribute('nonce', SCRIPT_NONCE)
    document.head.append(script)
    const applied = document.createElement('style')
    applied.setAttribute('nonce', NONCE)
    document.head.append(applied)
    const warnings = readPolicyWarnings(() =>
      createCache({ prefix: 'pg', hasDevChecks: true }).css({ color: 'red' })
    )
    expect(readElements('pg')[0]).toEqual({ nonce: NONCE, isApplied: true })
    expect(warnings).toEqual([])
  })

  it('is refused in silence without the development checks, as in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    createCache({ prefix: 'pe', hasDevChecks: false, speedy: true }).css({ color: 'red' })
    expect(readElements('pe')).toEqual([{ nonce: '', isApplied: false }])
    expect(warn).not.toHaveBeenCalled()
  })
})
