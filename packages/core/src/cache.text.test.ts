import { createCache, createDomSheet, createMemorySheet, type Cache } from './cache'
import { createStyleTag } from './extractStyles'
import { keyframes } from './keyframes'
import { createThemeClass, declareRootTheme } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
  vi.useRealTimers()
})

/** The text of the style element `data-style="<key>"` that the sheet of `cache` writes to. */
function readText(key: string): string | null | undefined {
  return [...document.querySelectorAll(`style[data-style="${key}"]`)].at(-1)?.textContent
}

/** Asserts that the text of the element is the rules of the cache, in order. */
function expectLiveText(cache: Cache, key: string): void {
  expect(readText(key)).toBe(cache.extract().css)
}

describe('a cache over a sheet written by text', () => {
  it('keeps the text of its style element equal to its live rules through every change', () => {
    vi.useFakeTimers()
    const cache = createCache({ prefix: 'u', hasRuleText: true })
    const theme = createThemeClass(
      cache,
      { '--u-a': 'red', '--u-b': 'blue' },
      { colorScheme: 'dark' }
    )
    expectLiveText(cache, 'u')
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const name = cache.css({ color: 'var(--u-a)', animation: `${fade} 1s` })
    cache.css({ color: 'var(--u-a)', animation: `${fade} 1s` })
    expectLiveText(cache, 'u')
    declareRootTheme(cache, { '--u-a': 'green' })
    declareRootTheme(cache, { '--u-a': 'black', '--u-b': 'white' })
    const margin = cache.css({ margin: 'var(--u-b)' })
    expectLiveText(cache, 'u')
    const release = cache.insertGlobal(cache.compileGlobal({ 'html, body': { margin: 0 } }))
    const { hold } = cache.cssHeld({ layer: 'overrides' }, { width: 7 })
    const releaseHeld = (hold as () => () => void)()
    expectLiveText(cache, 'u')
    release()
    releaseHeld()
    vi.runAllTimers()
    expectLiveText(cache, 'u')
    expect(readText('u')).toBe(
      [
        '@layer u-theme,u-global,u-components,u-overrides;',
        `@layer u-theme{.${theme}{color-scheme:dark;}}`,
        `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`,
        `@layer u-components{.${name}{color:var(--u-a);animation:${fade} 1s;}}`,
        `@layer u-theme{.${theme}{--u-a:red;}}`,
        `@layer u-components{.${margin}{margin:var(--u-b);}}`,
        `@layer u-theme{.${theme}{--u-b:blue;}}`,
        '@layer u-theme{:where(:root){--u-a:black;--u-b:white;}}',
      ].join('')
    )
  })

  it('reads the text that a server sent, and never the text of a sheet of the engine', () => {
    const server = createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    const sent = server.css({ color: 'red' })
    document.head.innerHTML = createStyleTag(server)
    const first = createCache({ prefix: 'u', hasLayers: false, hasRuleText: true })
    expect(first.css({ color: 'red' })).toBe(sent)
    const own = first.css({ color: 'blue' })
    // A second cache of the prefix reads the page again: the rule of the first one is not a server's.
    const second = createCache({ prefix: 'u', hasLayers: false, hasRuleText: true })
    expect(second.css({ color: 'blue' })).toBe(own)
    expect([...document.querySelectorAll('style')].map((element) => element.textContent)).toEqual([
      `.${sent}{color:red;}`,
      `.${own}{color:blue;}.${own}{color:blue;}`,
    ])
  })

  it('writes into the document of its container, an iframe too', () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument as Document
    const sheet = createDomSheet('f', frameDocument.head, { hasRuleText: true })
    const cache = createCache({ prefix: 'f', hasLayers: false, sheet })
    const name = cache.css({ color: 'red' })
    expect(frameDocument.querySelector('style[data-style="f"]')?.textContent).toBe(
      `.${name}{color:red;}`
    )
    expect(document.querySelector('style[data-style="f"]')).toBeNull()
    frame.remove()
  })
})
