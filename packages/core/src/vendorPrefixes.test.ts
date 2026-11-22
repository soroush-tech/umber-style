import { createCache, createMemorySheet, type CacheOptions } from './cache'
import { createEngine } from './createEngine'
import { keyframes } from './keyframes'
import { DEFAULT_SCOPING } from './scope'
import { compileRules, compileStyleRules, type StyleObject } from './serialize'
import { PREFIXED_FORMS } from './vendorPrefixes'

/** A cache without layers over a sheet in memory. */
function setup(options: CacheOptions = {}) {
  const sheet = createMemorySheet()
  return { sheet, cache: createCache({ prefix: 'v', sheet, hasLayers: false, ...options }) }
}

/** The body of the rule of `style`, written with the prefixed forms. */
const bodyOf = (style: StyleObject) => {
  const [rule] = compileStyleRules('.a', style, {
    hasColorFallbacks: true,
    hasValueRepair: false,
    scoping: DEFAULT_SCOPING,
    hasVendorPrefixes: true,
  })
  return rule.slice('.a{'.length, -1)
}

describe('the prefixed forms of a declaration', () => {
  it('writes the prefixed property first for each property of the table', () => {
    expect(bodyOf({ userSelect: 'none' })).toBe('-webkit-user-select:none;user-select:none;')
    expect(bodyOf({ textSizeAdjust: '100%' })).toBe(
      '-webkit-text-size-adjust:100%;text-size-adjust:100%;'
    )
    expect(bodyOf({ printColorAdjust: 'exact' })).toBe(
      '-webkit-print-color-adjust:exact;print-color-adjust:exact;'
    )
    expect(bodyOf({ boxDecorationBreak: 'clone' })).toBe(
      '-webkit-box-decoration-break:clone;box-decoration-break:clone;'
    )
    expect(bodyOf({ initialLetter: 2 })).toBe('-webkit-initial-letter:2;initial-letter:2;')
    expect(bodyOf({ textDecoration: 'underline dotted red' })).toBe(
      '-webkit-text-decoration:underline dotted red;text-decoration:underline dotted red;'
    )
  })

  it('writes the prefixed values of stretch first for the sizing properties, and nothing for another value', () => {
    for (const key of ['width', 'minWidth', 'maxWidth']) {
      const name = key.replace(/[A-Z]/, (letter) => `-${letter.toLowerCase()}`)
      expect(bodyOf({ [key]: 'stretch' })).toBe(
        `${name}:-moz-available;${name}:-webkit-fill-available;${name}:stretch;`
      )
    }
    for (const key of ['height', 'minHeight', 'maxHeight']) {
      const name = key.replace(/[A-Z]/, (letter) => `-${letter.toLowerCase()}`)
      expect(bodyOf({ [key]: 'stretch' })).toBe(`${name}:-webkit-fill-available;${name}:stretch;`)
    }
    expect(bodyOf({ width: '100%', height: 4 })).toBe('width:100%;height:4px;')
  })

  it('has an entry for exactly the properties of the documented table', () => {
    expect([...PREFIXED_FORMS.keys()]).toEqual([
      'user-select',
      'text-size-adjust',
      'print-color-adjust',
      'box-decoration-break',
      'initial-letter',
      'text-decoration',
      'width',
      'min-width',
      'max-width',
      'height',
      'min-height',
      'max-height',
    ])
  })

  it('writes the prefixed form of each item of a fallback list, before the list', () => {
    expect(bodyOf({ userSelect: ['text', 'all'] })).toBe(
      '-webkit-user-select:text;-webkit-user-select:all;user-select:text;user-select:all;'
    )
    expect(bodyOf({ width: ['100%', 'stretch'] })).toBe(
      'width:-moz-available;width:-webkit-fill-available;width:100%;width:stretch;'
    )
  })

  it('writes nothing more when the style declares the prefixed form itself, in the order it was written', () => {
    expect(bodyOf({ WebkitUserSelect: 'none', userSelect: 'none' })).toBe(
      '-webkit-user-select:none;user-select:none;'
    )
    expect(bodyOf({ userSelect: 'none', WebkitUserSelect: 'none' })).toBe(
      'user-select:none;-webkit-user-select:none;'
    )
    expect(bodyOf({ '-webkit-user-select': 'auto', userSelect: 'none' })).toBe(
      '-webkit-user-select:auto;user-select:none;'
    )
    expect(bodyOf({ width: ['-webkit-fill-available', 'stretch'] })).toBe(
      'width:-moz-available;width:-webkit-fill-available;width:stretch;'
    )
  })

  it('reaches nested selectors and at-rules, and leaves a property outside the table alone', () => {
    expect(
      compileStyleRules(
        '.a',
        { '&:hover': { userSelect: 'none' }, '@media print': { printColorAdjust: 'exact' } },
        {
          hasColorFallbacks: true,
          hasValueRepair: false,
          scoping: DEFAULT_SCOPING,
          hasVendorPrefixes: true,
        }
      )
    ).toEqual([
      '.a:hover{-webkit-user-select:none;user-select:none;}',
      '@media print{.a{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}',
    ])
    expect(bodyOf({ appearance: 'none', backdropFilter: 'blur(4px)' })).toBe(
      'appearance:none;backdrop-filter:blur(4px);'
    )
  })

  it('is not written by compileRules, nor by a context without the option', () => {
    expect(compileRules('.a', { userSelect: 'none' })).toEqual(['.a{user-select:none;}'])
  })
})

describe('the prefixed forms in a cache', () => {
  it('are written by default in a class, and the class has the name it has without them', () => {
    const on = setup()
    const off = setup({ hasVendorPrefixes: false })
    const name = on.cache.css({ userSelect: 'none' })
    expect(off.cache.css({ userSelect: 'none' })).toBe(name)
    expect(on.sheet.rules).toEqual([`.${name}{-webkit-user-select:none;user-select:none;}`])
    expect(off.sheet.rules).toEqual([`.${name}{user-select:none;}`])
  })

  it('are in the text of an entry, whose name does not change', () => {
    const on = setup()
    const off = setup({ hasVendorPrefixes: false })
    const entry = on.cache.createEntry({ userSelect: 'none' }) as unknown as {
      name: string
      styles: string
    }
    const plain = off.cache.createEntry({ userSelect: 'none' }) as unknown as typeof entry
    expect(entry.name).toBe(plain.name)
    expect(entry.styles).toBe('-webkit-user-select:none;user-select:none;')
    expect(plain.styles).toBe('user-select:none;')
  })

  it('are written in global rules and in the steps of keyframes', () => {
    const { cache, sheet } = setup()
    expect(cache.compileGlobal({ body: { userSelect: 'none' } }).rules).toEqual([
      'body{-webkit-user-select:none;user-select:none;}',
    ])
    const name = keyframes({ to: { textDecoration: 'underline' } }, { label: 'vp' })
    cache.insertKeyframes(name)
    expect(sheet.rules).toEqual([
      `@keyframes ${name}{100%{-webkit-text-decoration:underline;text-decoration:underline;}}`,
    ])
    expect(name).toBe(keyframes({ to: { textDecoration: 'underline' } }, { label: 'vp' }))
  })

  it('are written by an engine, and follow the option of the engine over a cache it is given', () => {
    const theme = { space: [0, 4] }
    const engine = createEngine(theme, { prefix: 'v', hasVendorPrefixes: false })
    const { cache, sheet } = setup()
    const name = engine.withCache(cache).css({ userSelect: 'none' })
    expect(sheet.rules).toEqual([`.${name}{user-select:none;}`])
    expect(cache.fingerprint).not.toContain('w=')
    expect(setup({ hasVendorPrefixes: false }).cache.fingerprint).toContain('w=0')
  })
})
