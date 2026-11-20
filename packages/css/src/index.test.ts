import { createCache, createMemorySheet, type StyleObject } from '@umber-style/core'
import {
  cache,
  css,
  cx,
  flush,
  getRegisteredStyles,
  hydrate,
  injectGlobal,
  keyframes,
  merge,
  sheet,
} from './index'

/** The text of the default instance's style element, rule by rule. */
function readStyleElement(): string[] {
  const element = document.querySelector<HTMLStyleElement>('style[data-style="css"]')
  return [...(element?.sheet?.cssRules ?? [])].map((rule) => rule.cssText)
}

afterEach(() => {
  flush()
})

describe('the default instance', () => {
  it('makes a class name, a string, and writes its rules into the style element', () => {
    const card = css({ padding: 8, '&:hover': { opacity: 0.9 } })
    expect(typeof card).toBe('string')
    expect(card).toMatch(/^css-[a-z0-9]+$/)
    expect(sheet.rules).toEqual([`.${card}{padding:8px;}`, `.${card}:hover{opacity:0.9;}`])
    expect(readStyleElement()).toEqual([
      `.${card} { padding: 8px; }`,
      `.${card}:hover { opacity: 0.9; }`,
    ])
  })

  it('writes its rules outside every cascade layer', () => {
    css({ color: 'red' })
    expect(cache.hasLayers).toBe(false)
    expect(sheet.rules.join('')).not.toContain('@layer')
  })

  it('merges with cx, the last winning', () => {
    const card = css({ padding: 8, color: 'black' })
    const active = css({ color: 'red' })
    const isActive = true
    const title = cx(card, isActive && active)
    expect(title).toBe(css({ padding: 8, color: 'red' }))
    expect(cx(card, !isActive && active)).toBe(card)
  })

  it('writes keyframes and global rules at once', () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    injectGlobal({ body: { margin: 0 } })
    expect(sheet.rules).toEqual([
      `@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`,
      'body{margin:0;}',
    ])
  })

  it('reads and merges classes with getRegisteredStyles and merge', () => {
    const first = css({ color: 'red' })
    const second = css({ color: 'blue' })
    const styles: StyleObject[] = []
    expect(getRegisteredStyles(styles, `app ${first} ${second}`)).toBe('app ')
    expect(styles).toEqual([{ color: 'red' }, { color: 'blue' }])
    expect(merge(`app ${first} ${second}`)).toBe(`app ${second}`)
  })

  it('hydrates ids so that their rules are not written', () => {
    const server = createCache({ prefix: 'css', hasLayers: false, sheet: createMemorySheet() })
    const name = server.css({ margin: 4 })
    hydrate(server.extract().ids)
    expect(css({ margin: 4 })).toBe(name)
    expect(sheet.rules).toEqual([])
  })

  it('empties the cache with flush, and writes a style again when it is next used', () => {
    const name = css({ margin: 2 })
    expect(cache.registered.has(name)).toBe(true)
    flush()
    expect(sheet.rules).toEqual([])
    expect(readStyleElement()).toEqual([])
    expect(cache.registered.size).toBe(0)
    expect(css({ margin: 2 })).toBe(name)
    expect(sheet.rules).toEqual([`.${name}{margin:2px;}`])
  })
})
