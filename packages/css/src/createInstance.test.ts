import {
  createCache,
  createEngine,
  createMemorySheet,
  createStyleTag,
  type Sheet,
  type StyleObject,
  type UmberSheet,
} from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import createInstance, { createInstance as namedCreateInstance } from './createInstance'

/** An instance over an in-memory sheet, with its own key. */
function createTestInstance(key = 't') {
  return createInstance({ key, sheet: createMemorySheet() })
}

describe('css', () => {
  it('returns a class name, a string, for a style object', () => {
    const { css, sheet } = createTestInstance()
    const name = css({ color: 'red', '&:hover': { color: 'blue' } })
    expect(name).toMatch(/^t-[a-z0-9]+$/)
    expect(sheet.rules).toEqual([`.${name}{color:red;}`, `.${name}:hover{color:blue;}`])
  })

  it('gives an equal style the same class, and writes its rules once', () => {
    const { css, sheet } = createTestInstance()
    expect(css({ color: 'red' })).toBe(css({ color: 'red' }))
    expect(sheet.rules).toHaveLength(1)
  })

  it('merges style objects left to right, the last winning', () => {
    const { css } = createTestInstance()
    expect(css({ color: 'red', margin: 0 }, { color: 'blue' })).toBe(
      css({ margin: 0, color: 'blue' })
    )
  })

  it('flattens lists, nested lists too, and skips false, null, undefined, empty strings and true', () => {
    const { css } = createTestInstance()
    const flat = css({ color: 'red' }, { margin: 0 }, { padding: 4 })
    expect(
      css([{ color: 'red' }, [false, [{ margin: 0 }, null]], undefined, '', true, { padding: 4 }])
    ).toBe(flat)
  })

  it('resolves class names this cache made back to their styles', () => {
    const { css } = createTestInstance()
    const base = css({ color: 'red', margin: 0 })
    expect(css(base, { color: 'blue' })).toBe(css({ margin: 0, color: 'blue' }))
  })

  it('passes other class names through, in front of the class', () => {
    const { css } = createTestInstance()
    const name = css({ color: 'red' })
    expect(css('app-card', { color: 'red' }, 'is-open')).toBe(`app-card is-open ${name}`)
    expect(css('app-card')).toBe('app-card')
  })

  it('returns an empty string for nothing', () => {
    const { css } = createTestInstance()
    expect(css()).toBe('')
    expect(css(null)).toBe('')
    expect(css(false, null, undefined)).toBe('')
    expect(css({})).toBe('')
  })

  it('reads a string that holds ":" or "{" as CSS text', () => {
    const { css, sheet } = createTestInstance()
    const name = css('color: red; &:hover { opacity: 0.5; }')
    expect(name).toBe(css({ color: 'red', '&:hover': { opacity: '0.5' } }))
    expect(sheet.rules).toEqual([`.${name}{color:red;}`, `.${name}:hover{opacity:0.5;}`])
    expect(css('&:focus{outline:none}')).toBe(css({ '&:focus': { outline: 'none' } }))
  })

  it('merges CSS text in order with style objects and classes, and passes class names through', () => {
    const { css } = createTestInstance()
    const base = css({ margin: 0, color: 'black' })
    expect(css(base, 'color: red; padding: 4px;', { padding: 8 }, 'app-card')).toBe(
      `app-card ${css({ margin: 0, color: 'red', padding: 8 })}`
    )
    expect(css({ color: 'red' }, ['color: blue;'])).toBe(css({ color: 'blue' }))
  })

  it('resolves a class of this cache back to its style when its label held a character a class name cannot', () => {
    const { css } = createTestInstance()
    const labelled = css({ label: 'a:b', color: 'red' })
    expect(labelled).toContain('a-b')
    expect(css(labelled, { margin: 0 })).toBe(css({ label: 'a:b', color: 'red', margin: 0 }))
  })

  it('throws the TypeError of the parser for CSS text that cannot be read', () => {
    const { css } = createTestInstance()
    expect(() => css('color: red; }', 'app')).toThrow(
      new TypeError('parseStyleTemplate(): a "}" without a "{" at line 1: "color: red; }"')
    )
  })

  it('reads a tagged template as CSS text', () => {
    const { css } = createTestInstance()
    const color = 'red'
    expect(css`
      color: ${color};
      &:hover {
        opacity: 0.5;
      }
    `).toBe(css({ color: 'red', '&:hover': { opacity: '0.5' } }))
  })

  it('merges a style object and a class of this cache interpolated between declarations', () => {
    const { css } = createTestInstance()
    const base = css({ margin: 0 })
    const extra = { padding: 4 }
    expect(css`
      ${base};
      ${extra};
      color: blue;
    `).toBe(css({ margin: 0, padding: 4, color: 'blue' }))
  })

  it('throws a TypeError for a function interpolated in a template: there are no props', () => {
    const { css } = createTestInstance()
    expect(
      () => css`
        color: ${() => 'red'};
      `
    ).toThrow(
      new TypeError(
        'css(): an interpolation of this template is a function, which needs props or a theme, and css() has none. Call it yourself and interpolate what it returns.'
      )
    )
  })
})

describe('cx', () => {
  it('merges classes this cache made into one new class, the last winning', () => {
    const { css, cx } = createTestInstance()
    const card = css({ padding: 8, color: 'black' })
    const active = css({ color: 'red' })
    expect(cx(card, active)).toBe(css({ padding: 8, color: 'red' }))
    expect(cx(active, card)).toBe(css(active, card))
    expect(cx(active, card)).not.toBe(cx(card, active))
  })

  it('passes other class names through, in front of the merged class', () => {
    const { css, cx } = createTestInstance()
    const card = css({ padding: 8 })
    const active = css({ color: 'red' })
    expect(cx('app', card, 'open', active)).toBe(`app open ${css({ padding: 8, color: 'red' })}`)
  })

  it('accepts falsy values, lists and objects of class names to booleans', () => {
    const { css, cx } = createTestInstance()
    const card = css({ padding: 8 })
    const active = css({ color: 'red' })
    expect(cx([card, [null, { [active]: true, hidden: false }]], undefined, false, '')).toBe(
      css({ padding: 8, color: 'red' })
    )
    expect(cx({ app: 1, other: 0 }, ['open'])).toBe('app open')
  })

  it('keeps the classes as they are when fewer than two were made by this cache', () => {
    const { css, cx } = createTestInstance()
    const card = css({ padding: 8 })
    expect(cx('app', card)).toBe(`app ${card}`)
    expect(cx()).toBe('')
  })
})

describe('keyframes', () => {
  it('returns the name of the animation and writes its rule at once', () => {
    const { keyframes, sheet } = createTestInstance()
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    expect(fade).toMatch(/^keyframes-[a-z0-9]+$/)
    expect(sheet.rules).toEqual([`@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`])
    expect(keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })).toBe(fade)
    expect(sheet.rules).toHaveLength(1)
  })

  it('reads a tagged template as steps', () => {
    const { keyframes } = createTestInstance()
    const to = 1
    expect(keyframes`
      from { opacity: 0; }
      to { opacity: ${to}; }
    `).toBe(keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }))
  })

  it('throws a TypeError for a function interpolated in a template: there is no theme', () => {
    const { keyframes } = createTestInstance()
    expect(() => keyframes`to { opacity: ${() => 1}; }`).toThrow(TypeError)
  })

  it('gives the rule to a class that uses the name, in a cache that has not written it', () => {
    const { keyframes } = createTestInstance('a')
    const { css, sheet } = createTestInstance('b')
    const spin = keyframes({ to: { transform: 'rotate(360deg)' } })
    const name = css({ animation: `${spin} 1s linear infinite` })
    expect(sheet.rules).toEqual([
      `@keyframes ${spin}{100%{transform:rotate(360deg);}}`,
      `.${name}{animation:${spin} 1s linear infinite;}`,
    ])
  })
})

describe('injectGlobal', () => {
  it('writes global rules at once, once for the same text', () => {
    const { injectGlobal, sheet } = createTestInstance()
    injectGlobal({ body: { margin: 0 }, '@media (min-width: 40em)': { html: { fontSize: 18 } } })
    injectGlobal({ body: { margin: 0 }, '@media (min-width: 40em)': { html: { fontSize: 18 } } })
    expect(sheet.rules).toEqual([
      'body{margin:0;}',
      '@media (min-width: 40em){html{font-size:18px;}}',
    ])
  })

  it('takes several objects, lists and falsy values, in order', () => {
    const { injectGlobal, sheet } = createTestInstance()
    injectGlobal({ body: { margin: 0 } }, [null, [{ p: { margin: 4 } }]], false)
    expect(sheet.rules).toEqual(['body{margin:0;}', 'p{margin:4px;}'])
  })

  it('reads a tagged template as CSS text', () => {
    const { injectGlobal, sheet } = createTestInstance()
    const margin = 0
    const written = injectGlobal`
      body { margin: ${margin}; }
    `
    expect(written).toBeUndefined()
    expect(sheet.rules).toEqual(['body{margin:0;}'])
  })

  it('writes the keyframes the rules use first', () => {
    const { injectGlobal, keyframes, sheet } = createTestInstance()
    const fade = keyframes({ to: { opacity: 0 } })
    injectGlobal({ '.leaving': { animationName: fade } })
    expect(sheet.rules).toEqual([
      `@keyframes ${fade}{100%{opacity:0;}}`,
      `.leaving{animation-name:${fade};}`,
    ])
  })

  it('throws a TypeError for a function interpolated in a template', () => {
    const { injectGlobal } = createTestInstance()
    expect(() => injectGlobal`body { margin: ${() => 0}; }`).toThrow(TypeError)
  })
})

describe('getRegisteredStyles and merge', () => {
  it('collects the styles of the classes this cache made, and returns the others followed by a space', () => {
    const { css, getRegisteredStyles } = createTestInstance()
    const first = css({ color: 'red' })
    const second = css({ margin: 0 })
    const styles: StyleObject[] = []
    expect(getRegisteredStyles(styles, ` app  ${first} open ${second}`)).toBe('app open ')
    expect(styles).toEqual([{ color: 'red' }, { margin: 0 }])
    expect(getRegisteredStyles(styles, '')).toBe('')
  })

  it('merges two or more classes this cache made, and keeps a string with fewer as it is', () => {
    const { css, merge } = createTestInstance()
    const first = css({ color: 'red' })
    const second = css({ color: 'blue', margin: 0 })
    expect(merge(`${first} app ${second}`)).toBe(`app ${css({ color: 'blue', margin: 0 })}`)
    expect(merge(`app ${first}`)).toBe(`app ${first}`)
    expect(merge('app')).toBe('app')
  })
})

describe('hydrate', () => {
  it('marks the rules of a server render as present: a class, keyframes and global rules are not written again', () => {
    const server = createTestInstance('h')
    const fade = server.keyframes({ to: { opacity: 0 } })
    const name = server.css({ color: 'red', animation: `${fade} 1s` })
    server.injectGlobal({ body: { margin: 0 } })
    const { ids } = server.cache.extract()

    const client = createTestInstance('h')
    client.hydrate(ids)
    expect(client.css({ color: 'red', animation: `${fade} 1s` })).toBe(name)
    client.keyframes({ to: { opacity: 0 } })
    client.injectGlobal({ body: { margin: 0 } })
    expect(client.sheet.rules).toEqual([])
  })

  it('needs no call when the server sent the style element of the key: the browser reads it', () => {
    const server = createInstance({ key: 'page', sheet: createMemorySheet() })
    const name = server.css({ color: 'red' })
    document.head.insertAdjacentHTML('beforeend', createStyleTag(server.cache))

    const client = createInstance({ key: 'page' })
    expect(client.css({ color: 'red' })).toBe(name)
    expect(client.sheet.rules).toEqual([])
  })

  it('throws when the server sent the style element of the key with other options', () => {
    const server = createInstance({ key: 'other', sheet: createMemorySheet(), hasLayers: true })
    server.css({ color: 'red' })
    document.head.insertAdjacentHTML('beforeend', createStyleTag(server.cache))
    expect(() => createInstance({ key: 'other' })).toThrow(
      'Differing options: hasLayers (server: 1, browser: 0)'
    )
  })
})

describe('flush', () => {
  it('removes every rule and starts an empty cache: a style is written again when it is next used', () => {
    const { cache, css, flush, hydrate, injectGlobal, sheet } = createTestInstance()
    const name = css({ color: 'red' })
    injectGlobal({ body: { margin: 0 } })
    hydrate(['t-global-x'])
    flush()
    expect(sheet.rules).toEqual([])
    expect(cache.registered.size).toBe(0)
    expect(cache.extract()).toEqual({ css: '', ids: [] })
    expect(css({ color: 'red' })).toBe(name)
    injectGlobal({ body: { margin: 0 } })
    expect(sheet.rules).toEqual([`.${name}{color:red;}`, 'body{margin:0;}'])
  })

  it('leaves the rules of a sheet that cannot remove them', () => {
    const rules: string[] = []
    const sheet: Sheet = { rules, insert: (rule) => rules.push(rule) }
    const { css, flush } = createInstance({ key: 'n', sheet })
    const name = css({ color: 'red' })
    flush()
    expect(rules).toEqual([`.${name}{color:red;}`])
  })

  it('throws a TypeError for an instance that was given its cache', () => {
    const sheet = createMemorySheet()
    const { flush } = createInstance({ cache: createCache({ prefix: 's', sheet }), sheet })
    expect(flush).toThrow(
      new TypeError(
        'flush(): this instance was given its cache, which other code shares, so it cannot empty it.'
      )
    )
  })
})

describe('options', () => {
  it('uses the key as the prefix of every class name, and css by default', () => {
    expect(createTestInstance('app').css({ color: 'red' })).toMatch(/^app-/)
    expect(createInstance({ sheet: createMemorySheet() }).css({ color: 'red' })).toMatch(/^css-/)
  })

  it('writes outside every cascade layer by default, and in the layers when asked', () => {
    const plain = createTestInstance()
    plain.css({ color: 'red' })
    expect(plain.sheet.rules.join('')).not.toContain('@layer')
    const layered = createInstance({ key: 'l', sheet: createMemorySheet(), hasLayers: true })
    const name = layered.css({ color: 'red' })
    expect(layered.sheet.rules).toEqual([
      '@layer l-theme,l-global,l-components,l-overrides;',
      `@layer l-components{.${name}{color:red;}}`,
    ])
  })

  it('passes the other options to the cache', () => {
    const { css } = createInstance({ key: 'o', sheet: createMemorySheet(), suffix: '-x' })
    expect(css({ color: 'red' })).toMatch(/^o-[a-z0-9]+-x$/)
  })

  it('writes into the style element of its key in a document', () => {
    const { css } = createInstance({ key: 'dom' })
    const name = css({ color: 'red' })
    const element = document.querySelector<HTMLStyleElement>('style[data-style="dom"]')
    expect([...(element?.sheet?.cssRules ?? [])].map((rule) => rule.cssText)).toEqual([
      `.${name} { color: red; }`,
    ])
  })

  it('writes each rule as the text of an element outside production, and with insertRule when asked', () => {
    const text = createInstance({ key: 'text' })
    const name = text.css({ color: 'red' })
    text.injectGlobal({ body: { margin: 0 } })
    const readTexts = (key: string) =>
      [...document.querySelectorAll(`style[data-style="${key}"]`)].map(
        (element) => element.textContent
      )
    expect(readTexts('text')).toEqual([`.${name}{color:red;}`, 'body{margin:0;}'])
    // Flushed, the element of the first rule stays, empty, where the rules were.
    text.flush()
    expect(readTexts('text')).toEqual([''])
    text.css({ color: 'red' })
    expect(readTexts('text')).toEqual([`.${name}{color:red;}`])
    createInstance({ key: 'fast', speedy: true }).css({ color: 'red' })
    expect(readTexts('fast')).toEqual([''])
  })

  it('makes its style element with the nonce it is given, and writes the nonce into its tag', () => {
    const instance = createInstance({ key: 'strict', nonce: 'r4nd0m' })
    instance.css({ color: 'red' })
    const element = document.querySelector('style[data-style="strict"]')
    expect(element?.getAttribute('nonce')).toBe('r4nd0m')
    expect(instance.cache.nonce).toBe('r4nd0m')
    expect(createStyleTag(instance.cache)).toMatch(
      /^<style data-style="strict" data-options="[^"]*" nonce="r4nd0m">/
    )
  })
})

describe('a shared cache', () => {
  it('makes its classes in the given cache, with the given sheet, next to an engine', () => {
    const sheet = createMemorySheet()
    const shared = createCache({ prefix: 'shared', sheet })
    const engine = createEngine({ space: [0, 4] }, { cache: shared })
    const instance = createInstance({ cache: shared, sheet })
    const fromEngine = engine.css({ padding: engine.refs.space[1] })
    const name = instance.css(fromEngine, { margin: 0 })
    expect(instance.cache).toBe(shared)
    expect(instance.sheet).toBe(sheet)
    expect(shared.registered.get(name)).toEqual({ padding: 'var(--shared-space-1)', margin: 0 })
    expect(shared.extract().css).toContain(`.${name}{padding:var(--shared-space-1);margin:0;}`)
  })

  it('takes the sheet from the cache when it carries one', () => {
    const sheet = createMemorySheet()
    const shared = { ...createCache({ prefix: 'carried', sheet }), sheet }
    const instance = createInstance({ cache: shared, key: 'carried' })
    expect(instance.sheet).toBe(sheet)
    const name = instance.css({ color: 'red' })
    expect(sheet.rules).toEqual([
      shared.layerOrder,
      `@layer carried-components{.${name}{color:red;}}`,
    ])
  })

  it('takes a cache that carries its style elements as its sheet, as a cache of @umber-style/cache does', () => {
    const tags: UmberSheet = { tags: [] }
    const umberCache = {
      ...createCache({ prefix: 'elements', sheet: createMemorySheet() }),
      sheet: tags,
    }
    const instance = createInstance({ cache: umberCache })
    expect(instance.sheet).toBe(tags)
    expect(instance.cache).toBe(umberCache)
    const name = instance.css({ color: 'red' })
    expect(umberCache.extract().css).toContain(`.${name}{color:red;}`)
  })

  it('throws a TypeError when no sheet is known', () => {
    const shared = createCache({ prefix: 'nosheet', sheet: createMemorySheet() })
    expect(() => createInstance({ cache: shared })).toThrow(
      new TypeError(
        'createInstance(): the given cache has no `sheet` member: give the sheet it writes to as `sheet` too.'
      )
    )
  })

  it('throws a TypeError for a key that differs from the prefix of the cache', () => {
    const sheet = createMemorySheet()
    const shared = createCache({ prefix: 'one', sheet })
    expect(() => createInstance({ cache: shared, sheet, key: 'two' })).toThrow(
      new TypeError(
        'createInstance(): the key "two" differs from the prefix "one" of the given cache. Leave out `key`, or give the same one.'
      )
    )
  })
})

describe('the prefixed forms in the plain layer', () => {
  it('writes them in a class and in global rules by default, and not with hasVendorPrefixes false', () => {
    const { css, injectGlobal, sheet } = createTestInstance()
    const name = css({ userSelect: 'none' })
    injectGlobal({ body: { textSizeAdjust: '100%' } })
    expect(sheet.rules).toEqual([
      `.${name}{-webkit-user-select:none;user-select:none;}`,
      'body{-webkit-text-size-adjust:100%;text-size-adjust:100%;}',
    ])
    const plain = createInstance({ key: 't', sheet: createMemorySheet(), hasVendorPrefixes: false })
    expect(plain.css({ userSelect: 'none' })).toBe(name)
    expect(plain.sheet.rules).toEqual([`.${name}{user-select:none;}`])
  })
})

describe('the export', () => {
  it('is the named export too, with the same type', () => {
    expect(namedCreateInstance).toBe(createInstance)
    expectTypeOf(namedCreateInstance).toEqualTypeOf(createInstance)
  })
})
