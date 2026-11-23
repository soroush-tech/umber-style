import { createCache, createDomSheet, createMemorySheet, type Cache } from './cache'
import { createStyleTag } from './extractStyles'
import { keyframes } from './keyframes'
import { createThemeClass, declareRootTheme } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
  vi.useRealTimers()
})

/** The text of the style elements `data-style="<key>"`, joined in document order: one rule each. */
function readText(key: string): string {
  return [...document.querySelectorAll(`style[data-style="${key}"]`)]
    .map((element) => element.textContent)
    .join('')
}

/** Asserts that the text of the element is the rules of the cache, in order. */
function expectLiveText(cache: Cache, key: string): void {
  expect(readText(key)).toBe(cache.extract().css)
}

describe('a cache over a sheet written by text', () => {
  it('keeps the text of its style element equal to its live rules through every change', () => {
    vi.useFakeTimers()
    const cache = createCache({ prefix: 'u', speedy: false })
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
    const first = createCache({ prefix: 'u', hasLayers: false, speedy: false })
    expect(first.css({ color: 'red' })).toBe(sent)
    const own = first.css({ color: 'blue' })
    // A second cache of the prefix reads the page again: the rule of the first one is not a server's.
    const second = createCache({ prefix: 'u', hasLayers: false, speedy: false })
    expect(second.css({ color: 'blue' })).toBe(own)
    // Each cache writes its rule into a style element of its own.
    expect([...document.querySelectorAll('style')].map((element) => element.textContent)).toEqual([
      `.${sent}{color:red;}`,
      `.${own}{color:blue;}`,
      `.${own}{color:blue;}`,
    ])
  })

  it('writes each rule into a style element of its own, in order, and removes the element with its rule', () => {
    const sheet = createDomSheet('o', document.head, { speedy: false, nonce: 'n0nce' })
    // The first element is made at the first rule, at the end of the container then: after an element
    // that came in after the sheet was made.
    const before = document.createElement('meta')
    document.head.append(before)
    expect(document.head.children).toHaveLength(1)
    for (const rule of ['.a{color:red;}', '.b{color:blue;}', '.c{color:green;}']) sheet.insert(rule)
    const elements = [...document.head.children]
    expect(elements.map((element) => element.textContent)).toEqual([
      '',
      '.a{color:red;}',
      '.b{color:blue;}',
      '.c{color:green;}',
    ])
    expect(elements.map((element) => element.getAttribute('data-style'))).toEqual([
      null,
      'o',
      'o',
      'o',
    ])
    expect(elements.map((element) => element.getAttribute('nonce'))).toEqual([
      null,
      'n0nce',
      'n0nce',
      'n0nce',
    ])
    expect(elements.slice(1).map((element) => element.childNodes.length)).toEqual([1, 1, 1])
    sheet.remove?.(1)
    sheet.insert('.d{color:black;}')
    expect([...document.head.children].map((element) => element.textContent)).toEqual([
      '',
      '.a{color:red;}',
      '.c{color:green;}',
      '.d{color:black;}',
    ])
  })

  it('keeps the place of its rules when every one is removed, for the next rule', () => {
    const before = document.createElement('meta')
    document.head.append(before)
    const sheet = createDomSheet('o', document.head, { speedy: false })
    document.head.append(document.createElement('link'))
    sheet.insert('.a{color:red;}')
    sheet.insert('.b{color:blue;}')
    sheet.remove?.(1)
    sheet.remove?.(0)
    expect(sheet.rules).toEqual([])
    // The last element stays, empty, where the rules were.
    // (made at the first rule, after the link that came in after the sheet was made).
    expect([...document.head.children].map((element) => element.tagName)).toEqual([
      'META',
      'LINK',
      'STYLE',
    ])
    expect(readText('o')).toBe('')
    sheet.insert('.c{color:green;}')
    sheet.insert('.d{color:black;}')
    expect([...document.head.children].map((element) => element.textContent)).toEqual([
      '',
      '',
      '.c{color:green;}',
      '.d{color:black;}',
    ])
  })

  it('uses an empty style element of its key that the page has as the first one, which marks the place of the rules', () => {
    const marker = document.createElement('style')
    marker.dataset.style = 'o'
    document.head.append(marker, document.createElement('link'))
    const sheet = createDomSheet('o', document.head, { speedy: false, nonce: 'n0nce' })
    sheet.insert('.a{color:red;}')
    sheet.insert('.b{color:blue;}')
    const elements = [...document.head.children]
    expect(elements[0]).toBe(marker)
    expect(elements.map((element) => element.textContent)).toEqual([
      '.a{color:red;}',
      '.b{color:blue;}',
      '',
    ])
    // The element of the page is used as it is; the ones the sheet makes carry the nonce.
    expect(elements.map((element) => element.getAttribute('nonce'))).toEqual([null, 'n0nce', null])
  })

  it('keeps two sheets of one key in elements of their own, and the element of either out of the other', () => {
    const first = createDomSheet('o', document.head, { speedy: false })
    const second = createDomSheet('o', document.head, { speedy: false })
    first.insert('.a{color:red;}')
    second.insert('.b{color:blue;}')
    first.insert('.c{color:green;}')
    first.remove?.(0)
    first.remove?.(0)
    // A third sheet does not take the empty element that keeps the place of the first one's rules.
    const third = createDomSheet('o', document.head, { speedy: false })
    third.insert('.d{color:black;}')
    first.insert('.e{color:white;}')
    expect([...document.head.children].map((element) => element.textContent)).toEqual([
      '.e{color:white;}',
      '.b{color:blue;}',
      '.d{color:black;}',
    ])
  })

  it('writes the root rule anew in place of its element: one element out, one in, after the others', () => {
    const cache = createCache({ prefix: 'o', speedy: false })
    const name = cache.css({ color: 'var(--o-a)', margin: 'var(--o-b)' })
    declareRootTheme(cache, { '--o-a': 'red' })
    const count = document.querySelectorAll('style[data-style="o"]').length
    declareRootTheme(cache, { '--o-a': 'black', '--o-b': 'white' })
    const texts = [...document.querySelectorAll('style[data-style="o"]')].map(
      (element) => element.textContent
    )
    expect(texts).toHaveLength(count)
    expect(texts).toEqual([
      '@layer o-theme,o-global,o-components,o-overrides;',
      `@layer o-components{.${name}{color:var(--o-a);margin:var(--o-b);}}`,
      '@layer o-theme{:where(:root){--o-a:black;--o-b:white;}}',
    ])
  })

  it('does not read the elements it writes as a page sends them, however many arrive', async () => {
    const cache = createCache({ prefix: 'o', hasLayers: false, speedy: false })
    const names = [1, 2, 3].map((padding) => cache.css({ padding }))
    // The watch of the page reports the elements after this task.
    await Promise.resolve()
    const second = createCache({ prefix: 'o', hasLayers: false, speedy: false })
    expect(second.css({ padding: 2 })).toBe(names[1])
    // The second cache writes the rule again: the rules of the first are not a server's.
    expect(second.extract().css).toBe(`.${names[1]}{padding:2px;}`)
    expect(document.querySelectorAll('style[data-style="o"]')).toHaveLength(4)
  })

  it('writes into the document of its container, an iframe too', () => {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    const frameDocument = frame.contentDocument as Document
    const sheet = createDomSheet('f', frameDocument.head, { speedy: false })
    const cache = createCache({ prefix: 'f', hasLayers: false, sheet })
    const name = cache.css({ color: 'red' })
    expect(frameDocument.querySelector('style[data-style="f"]')?.textContent).toBe(
      `.${name}{color:red;}`
    )
    expect(document.querySelector('style[data-style="f"]')).toBeNull()
    frame.remove()
  })
})
