import { createCache, createDomSheet, createMemorySheet, type Sheet } from './cache'
import { createStyleTag } from './extractStyles'
import { keyframes } from './keyframes'
import { createThemeClass } from './theme'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function setup(options: { hasLayers?: boolean; sheet?: Sheet } = {}) {
  const sheet = options.sheet ?? createMemorySheet()
  const cache = createCache({ prefix: 'u', hasLayers: false, ...options, sheet })
  /** A class held for `width`, as a styled component given `{ width }` makes it. */
  const width = (value: number) => cache.cssHeld({ layer: 'overrides' }, { width: value })
  return { cache, sheet, width }
}

/** Runs the delay before a removal. */
const wait = () => vi.runAllTimers()

describe('a held class', () => {
  it('is written at once, and removed after the delay once the last holder lets it go', () => {
    const { cache, sheet, width } = setup()
    const { className, hold } = width(4)
    expect(sheet.rules).toEqual([`.${className}{width:4px;}`])
    const release = (hold as () => () => void)()
    wait()
    expect(sheet.rules).toEqual([`.${className}{width:4px;}`])
    release()
    expect(sheet.rules).toHaveLength(1)
    wait()
    expect(sheet.rules).toEqual([])
    expect(cache.registered.has(className)).toBe(false)
    expect(cache.extract()).toEqual({ css: '', ids: [] })
    // The same value later is written again, under the same name.
    expect(width(4).className).toBe(className)
    expect(sheet.rules).toEqual([`.${className}{width:4px;}`])
  })

  it('leaves one class of a hundred values that one element took in turn', () => {
    const { sheet, width } = setup()
    let release = (width(0).hold as () => () => void)()
    for (let value = 1; value < 100; value++) {
      const next = (width(value).hold as () => () => void)()
      release()
      release = next
      if (value % 10 === 0) wait()
    }
    wait()
    expect(sheet.rules).toEqual([`.${width(99).className}{width:99px;}`])
  })

  it('is one class for two holders, and goes when the last one lets it go', () => {
    const { sheet, width } = setup()
    const { className, hold } = width(8)
    expect(width(8).hold).toBe(hold)
    const first = (hold as () => () => void)()
    const second = (hold as () => () => void)()
    first()
    first()
    wait()
    expect(sheet.rules).toEqual([`.${className}{width:8px;}`])
    second()
    wait()
    expect(sheet.rules).toEqual([])
  })

  it('stays when it is let go and held again before the delay ends', () => {
    const { sheet, width } = setup()
    const { className, hold } = width(2)
    ;(hold as () => () => void)()()
    ;(hold as () => () => void)()
    wait()
    expect(sheet.rules).toEqual([`.${className}{width:2px;}`])
  })

  it('is removed when nothing holds it within the delay, and written again by a late hold', () => {
    const { sheet, width } = setup()
    const { className, hold } = width(6)
    wait()
    expect(sheet.rules).toEqual([])
    const release = (hold as () => () => void)()
    expect(sheet.rules).toEqual([`.${className}{width:6px;}`])
    wait()
    expect(sheet.rules).toHaveLength(1)
    release()
    wait()
    expect(sheet.rules).toEqual([])
  })

  it('takes the label, and keeps foreign class names in front of it', () => {
    const { cache, width } = setup()
    const { className } = cache.cssHeld({ layer: 'overrides', label: 'bar' }, 'mine', {
      width: 1,
    })
    expect(className).toMatch(/^mine u-bar-\w+$/)
    expect(width(1).className).not.toBe(className.split(' ')[1])
  })

  it('is no class, and nothing to hold, for styles with no rule', () => {
    const { cache, sheet } = setup()
    expect(cache.cssHeld({}, 'mine', {})).toEqual({ className: 'mine', hold: undefined })
    expect(sheet.rules).toEqual([])
  })
})

describe('a class that is permanent', () => {
  it('is the class of one sheet entry given alone, with nothing to hold', () => {
    const { cache, sheet } = setup()
    const entry = cache.createEntry({ color: 'red' })
    const { className, hold } = cache.cssHeld({ layer: 'overrides' }, entry)
    expect(hold).toBeUndefined()
    wait()
    expect(sheet.rules).toEqual([`.${className}{color:red;}`])
  })

  it('is the own class of an entry that is merged with an object: the merged class goes, the entry stays', () => {
    const { cache, sheet } = setup()
    const entry = cache.createEntry({ color: 'red' })
    const own = cache.cssIn('overrides', entry)
    const { className, hold } = cache.cssHeld({ layer: 'overrides' }, entry, { width: 1 })
    ;(hold as () => () => void)()()
    wait()
    expect(sheet.rules).toEqual([`.${own}{color:red;}`])
    expect(className).not.toBe(own)
  })

  it('is one that cssWith made: no hold', () => {
    const { cache, sheet } = setup()
    const made = cache.cssIn('overrides', { width: 3 })
    expect(cache.cssHeld({ layer: 'overrides' }, { width: 3 })).toEqual({
      className: made,
      hold: undefined,
    })
    wait()
    expect(sheet.rules).toEqual([`.${made}{width:3px;}`])
  })

  it('becomes so when cssWith or an entry makes a held class', () => {
    const { cache, sheet, width } = setup()
    const first = width(3)
    const release = (first.hold as () => () => void)()
    expect(cache.cssIn('overrides', { width: 3 })).toBe(first.className)
    release()
    const second = width(5)
    const entry = cache.createEntry({ width: 5 })
    expect(cache.cssIn('overrides', entry)).toBe(second.className)
    // A hold of a class that is permanent counts nothing.
    ;(second.hold as () => () => void)()()
    wait()
    expect(sheet.rules).toEqual([
      `.${first.className}{width:3px;}`,
      `.${second.className}{width:5px;}`,
    ])
    expect(width(5).hold).toBeUndefined()
  })

  it('is every class of a sheet that cannot remove', () => {
    const rules: string[] = []
    const { cache } = setup({ sheet: { rules, insert: (rule) => void rules.push(rule) } })
    const { className, hold } = cache.cssHeld({ layer: 'overrides' }, { width: 1 })
    expect(hold).toBeUndefined()
    wait()
    expect(rules).toEqual([`.${className}{width:1px;}`])
  })
})

describe('the removal of a held class', () => {
  it('leaves the theme rules replaceable and the global rules removable at their places', () => {
    const { cache, sheet, width } = setup()
    const light = createThemeClass(cache, { '--u-a': '1' }, { colorScheme: 'light' })
    const held = width(1)
    const release = (held.hold as () => () => void)()
    const releaseGlobal = cache.insertGlobal(cache.compileGlobal({ body: { margin: 0 } }))
    const dark = createThemeClass(cache, { '--u-a': '10' }, { colorScheme: 'dark' })
    release()
    wait()
    expect(sheet.rules).toEqual([
      `.${light}{color-scheme:light;}`,
      'body{margin:0;}',
      `.${dark}{color-scheme:dark;}`,
    ])
    const name = cache.css({ color: 'var(--u-a)' })
    releaseGlobal()
    expect(sheet.rules).toEqual([
      `.${light}{--u-a:1;color-scheme:light;}`,
      `.${dark}{--u-a:10;color-scheme:dark;}`,
      `.${name}{color:var(--u-a);}`,
    ])
  })

  it('keeps the places of the other held classes', () => {
    const { sheet, width } = setup()
    const [one, two, three] = [1, 2, 3].map((value) => width(value))
    const holds = [one, two, three].map(({ hold }) => (hold as () => () => void)())
    holds[0]()
    wait()
    holds[2]()
    wait()
    expect(sheet.rules).toEqual([`.${two.className}{width:2px;}`])
  })

  it('removes only the rules that the sheet took, and every rule of a class', () => {
    const rules: string[] = []
    const sheet: Sheet = {
      rules,
      insert: (rule) => void (rule.includes('bad') || rules.push(rule)),
      remove: (index) => void rules.splice(index, 1),
    }
    const { cache } = setup({ sheet })
    const kept = cache.css({ color: 'red' })
    const held = cache.cssHeld({}, { color: 'bad', '&:hover': { color: 'blue' } })
    expect(rules).toEqual([`.${kept}{color:red;}`, `.${held.className}:hover{color:blue;}`])
    ;(held.hold as () => () => void)()()
    wait()
    expect(rules).toEqual([`.${kept}{color:red;}`])
  })

  it('keeps the keyframes that the class used', () => {
    const { cache, sheet } = setup()
    const spin = keyframes({ to: { opacity: 0 } }, { label: 'spin' })
    const { className, hold } = cache.cssHeld({}, { animationName: spin })
    expect(cache.getAnimations(className)).toEqual([spin])
    ;(hold as () => () => void)()()
    wait()
    expect(cache.getAnimations(className)).toEqual([])
    expect(sheet.rules).toEqual([expect.stringMatching(/^@keyframes spin-/)])
  })

  it('deletes the rules from a style element of the browser, written by insertRule', () => {
    const { cache } = setup({ sheet: createDomSheet('u', undefined, { speedy: true }) })
    const element = document.querySelector('style[data-style="u"]') as HTMLStyleElement
    const kept = cache.css({ color: 'blue' })
    const { hold } = cache.cssHeld({}, { width: 7 })
    ;(element.sheet as CSSStyleSheet).insertRule('main{order:1;}', 0)
    ;(hold as () => () => void)()()
    wait()
    expect(
      [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText.replace(/\s+/g, ''))
    ).toEqual(['main{order:1;}', `.${kept}{color:blue;}`])
  })

  it('removes the style elements of its rules from the page, written by text', () => {
    const { cache } = setup({ sheet: createDomSheet('u', undefined, { speedy: false }) })
    const readTexts = () =>
      [...document.querySelectorAll('style[data-style="u"]')].map((element) => element.textContent)
    const kept = cache.css({ color: 'blue' })
    const { hold } = cache.cssHeld({}, { width: 7 })
    expect(readTexts()).toEqual([`.${kept}{color:blue;}`, expect.stringMatching(/\{width:7px;\}/)])
    ;(hold as () => () => void)()()
    wait()
    expect(readTexts()).toEqual([`.${kept}{color:blue;}`])
  })
})

describe('a held class on a page that a server rendered', () => {
  /** The page of a server that made the class of `{ width: 9 }` in the overrides layer. */
  function serve(hasLayers = true) {
    const server = createCache({ prefix: 'u', hasLayers, sheet: createMemorySheet() })
    const className = server.cssIn('overrides', { width: 9, '&:hover': { width: 10 } })
    document.head.innerHTML = createStyleTag(server)
    return className
  }
  const pageRules = () =>
    [...document.querySelectorAll('style')].flatMap((element) =>
      [...(element.sheet?.cssRules ?? [])].map((rule) => rule.cssText.replace(/\s+/g, ''))
    )
  const style = { width: 9, '&:hover': { width: 10 } }

  it('is taken over, kept until it was held, and removed from the page when let go', () => {
    const className = serve()
    const { cache, sheet } = setup({ hasLayers: true })
    const held = cache.cssHeld({ layer: 'overrides' }, style)
    expect(held.className).toBe(className)
    expect(sheet.rules).toEqual([])
    wait()
    expect(pageRules()).toHaveLength(3)
    ;(held.hold as () => () => void)()()
    wait()
    expect(pageRules()).toEqual(['@layeru-theme,u-global,u-components,u-overrides;'])
    // Held again, it is written by the cache (the page has the layer order).
    cache.cssHeld({ layer: 'overrides' }, style)
    expect(sheet.rules).toEqual([
      `@layer u-overrides{.${className}{width:9px;}}`,
      `@layer u-overrides{.${className}:hover{width:10px;}}`,
    ])
  })

  it('stays on the page, for good, when its rules cannot all be found there', () => {
    serve(false)
    // An element of the engine that the browser gives no sheet.
    const other = document.createElement('style')
    other.type = 'text/x'
    other.dataset.precedence = 'u'
    document.head.appendChild(other)
    const { cache, sheet } = setup()
    // A rule of the page is gone.
    const element = document.querySelector('style[data-style="u"]') as HTMLStyleElement
    ;(element.sheet as CSSStyleSheet).deleteRule(1)
    const { hold } = cache.cssHeld({}, style)
    ;(hold as () => () => void)()()
    wait()
    expect(pageRules()).toHaveLength(1)
    expect(cache.cssHeld({}, style).hold).toBeUndefined()
    expect(sheet.rules).toEqual([])
  })
})
