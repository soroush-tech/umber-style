// @vitest-environment node
import { alpha } from './alpha'
import {
  createCache,
  createMemorySheet,
  type Cache,
  type CacheOptions,
  type ClassValue,
} from './cache'
import * as contentMemo from './contentMemo'
import { createEngine } from './createEngine'
import { extractPageStyles } from './extractStyles'
import { createLiveValue } from './liveValue'
import { mergeStyles, type StyleObject } from './serialize'

vi.mock('./contentMemo', { spy: true })

/** A style written as the inputs are, past what the style types take. */
const raw = (style: object) => style as ClassValue

/** Two caches of the same options over sheets of their own: the memo off (as before), and on. */
function createPair(options: CacheOptions = {}) {
  const make = (hasStyleMemo: boolean) => {
    const sheet = createMemorySheet()
    return { sheet, cache: createCache({ prefix: 'm', ...options, sheet, hasStyleMemo }) }
  }
  return { off: make(false), on: make(true) }
}

/** What a cache holds: its rules, each registered class with its style, and its CSS. */
function readState({ cache, sheet }: { cache: Cache; sheet: { rules: readonly string[] } }) {
  return {
    rules: [...sheet.rules],
    registered: [...cache.registered.entries()],
    extract: cache.extract(),
    page: cache.extractPage([...cache.registered.keys()]).css,
  }
}

/** Runs `calls` on both caches of a pair: each call gives the same class on both, and both end alike. */
function expectSame(pair: ReturnType<typeof createPair>, calls: ((cache: Cache) => unknown)[]) {
  for (const call of calls) expect(call(pair.on.cache)).toEqual(call(pair.off.cache))
  expect(readState(pair.on)).toEqual(readState(pair.off))
}

/** The calls of `styles`, each made twice in a new object, then once more as the same objects. */
const callsOf = (styles: object[]) => [
  ...styles.map((style) => (cache: Cache) => cache.css(raw({ ...style }))),
  ...styles.map((style) => (cache: Cache) => cache.css(raw({ ...style }))),
  ...styles.map((style) => (cache: Cache) => cache.css(raw(style))),
]

/** A random number generator of a fixed seed (mulberry32), so that the generated styles are the same each run. */
function createRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const KEYS = [
  'width',
  'margin',
  'marginLeft',
  'fontSize',
  'animationDuration',
  'opacity',
  'userSelect',
  'label',
  '--x',
  'a;b',
  '1',
  '2',
]
const NESTED_KEYS = ['&:hover', '@media (min-width: 1px)', ':focus', '& > p', 'web', 'native']
const VALUES: unknown[] = [
  1,
  '1',
  0,
  '0',
  -0,
  1.5,
  ' 1 ',
  '',
  'b;c:d',
  'red',
  'none',
  '4:b',
  Number.NaN,
  undefined,
  null,
  false,
]

/** A generated style: plain values, and sometimes a nested style, a list or an `alpha()` value. */
function createStyle(random: () => number, depth = 0): Record<string, unknown> {
  const style: Record<string, unknown> = {}
  const count = Math.floor(random() * 4) + 1
  for (let index = 0; index < count; index++) {
    const roll = random()
    if (roll < 0.15 && depth < 2) {
      style[NESTED_KEYS[Math.floor(random() * NESTED_KEYS.length)]] = createStyle(random, depth + 1)
    } else if (roll < 0.18) style.display = ['block', 'grid']
    else if (roll < 0.2) style.color = alpha('#ff0000', 0.5)
    else if (roll < 0.22) style['&:focus'] = {}
    else {
      const key = KEYS[Math.floor(random() * KEYS.length)]
      style[key] = VALUES[Math.floor(random() * VALUES.length)]
    }
  }
  return style
}

describe('the memo of contents (hasStyleMemo)', () => {
  it('is off by default: no memo is made and the path of every call is the one without it', () => {
    vi.mocked(contentMemo.createContentMemo).mockClear()
    const cache = createCache({ prefix: 'm', sheet: createMemorySheet() })
    cache.css({ color: 'red' })
    cache.css({ color: 'red' })
    cache.withStyleOptions({ hasVendorPrefixes: false }).css({ color: 'red' })
    const engine = createEngine({}, { prefix: 'e' })
    engine.css({ color: 'red' })
    expect(contentMemo.createContentMemo).not.toHaveBeenCalled()
    expect(contentMemo.readStableStyle).not.toHaveBeenCalled()
  })

  it('finds the same contents in a new object, and tells a string from a number (docs/options.md)', () => {
    const cache = createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo: true })
    const first = cache.css({ width: 1 }) // compiled and named
    const second = cache.css({ width: 1 }) // the same contents again: compiled, and remembered
    const found = cache.css({ width: 1 }) // and from now on found, not compiled
    const third = cache.css({ width: '1' }) // other contents: a string is not a number, and gets no unit
    expect([second, found]).toEqual([first, first])
    expect(third).not.toBe(first)
    expect(cache.extract().css).toContain(`.${first}{width:1px;}`)
    expect(cache.extract().css).toContain(`.${third}{width:1;}`)
  })

  it('is made by the option, of the cache and of an engine that makes its cache', () => {
    vi.mocked(contentMemo.createContentMemo).mockClear()
    createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo: true }).css({ width: 1 })
    createEngine({}, { prefix: 'e', hasStyleMemo: true }).css({ width: 1 })
    expect(contentMemo.createContentMemo).toHaveBeenCalledTimes(2)
  })

  it('gives every class, rule, registered style and page of the full path, on generated styles', () => {
    const random = createRandom(10)
    const styles = Array.from({ length: 400 }, () => createStyle(random))
    for (const options of [
      {},
      { hasLayers: false, hasLabels: false },
      { hasVendorPrefixes: false },
    ]) {
      const pair = createPair(options)
      const calls = Array.from({ length: 2000 }, () => {
        const first = styles[Math.floor(random() * styles.length)]
        const second = styles[Math.floor(random() * styles.length)]
        const roll = random()
        if (roll < 0.6) return (cache: Cache) => cache.css(raw({ ...first }))
        if (roll < 0.7) return (cache: Cache) => cache.css(raw(first))
        if (roll < 0.8) return (cache: Cache) => cache.css(raw({ ...first }), raw({ ...second }))
        if (roll < 0.9) {
          return (cache: Cache) => cache.cssWith({ label: 'Box', after: 'm-a' }, raw({ ...first }))
        }
        return (cache: Cache) => cache.cssIn('overrides', raw({ ...first }), false, null)
      })
      expectSame(pair, calls)
    }
  })

  describe('a class with no rule: what the memo names is always in the sheet', () => {
    it('answers for one cache only: a fresh cache writes the rule and its page has it', () => {
      const style = { color: 'red', padding: 8 }
      const first = createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo: true })
      const className = first.css({ ...style })
      const sheet = createMemorySheet()
      const second = createCache({ prefix: 'm', sheet, hasStyleMemo: true })
      expect(second.css({ ...style })).toBe(className)
      expect(sheet.rules.some((rule) => rule.includes(`.${className}{`))).toBe(true)
      const html = `<div class="${className}"></div>`
      expect(extractPageStyles(second, html).css).toContain(`.${className}{color:red;padding:8px;}`)
    })

    it('answers for one view only: two engines over one cache write what each view writes', () => {
      const pair = createPair()
      const views = (cache: Cache) => [
        cache.withStyleOptions({ hasVendorPrefixes: false }),
        cache.withStyleOptions({ hasColorFallbacks: false }),
        cache,
      ]
      const calls = [0, 1, 2, 0, 1, 2].flatMap((index) => [
        (cache: Cache) => views(cache)[index].css({ userSelect: 'none' }),
        (cache: Cache) => views(cache)[index].css({ color: alpha('#ff0000', 0.5) }),
      ])
      expectSame(pair, calls)
      // The view that came first wrote the class; the others name it and write nothing.
      expect(pair.on.sheet.rules).toContain('@layer m-components{.m-1fp6bg{user-select:none;}}')
    })

    it('writes the rule of a held class let go when the same contents come again', async () => {
      const sheet = createMemorySheet()
      const cache = createCache({ prefix: 'm', sheet, hasLayers: false, hasStyleMemo: true })
      const held = cache.cssHeld({}, { width: 4 })
      const release = (held.hold as () => () => void)()
      release()
      await new Promise((resolve) => setTimeout(resolve, 5))
      expect(sheet.rules).toEqual([])
      expect(cache.css({ width: 4 })).toBe(held.className)
      expect(cache.css({ width: 4 })).toBe(held.className)
      expect(sheet.rules).toEqual([`.${held.className}{width:4px;}`])
    })

    it('keeps for good a class it named, which a holder that comes later cannot take away', async () => {
      const sheet = createMemorySheet()
      const cache = createCache({ prefix: 'm', sheet, hasLayers: false, hasStyleMemo: true })
      const className = cache.css({ width: 4 })
      const held = cache.cssHeld({}, { width: 4 })
      expect(held).toEqual({ className, hold: undefined })
      await new Promise((resolve) => setTimeout(resolve, 5))
      expect(cache.css({ width: 4 })).toBe(className)
      expect(sheet.rules).toEqual([`.${className}{width:4px;}`])
    })

    it('marks the variables of a rule as the full path does, with pruning', () => {
      const theme = { palette: { primary: '#123456', text: '#111111' } }
      const engines = [false, true].map((hasStyleMemo) => {
        const cache = createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo })
        const engine = createEngine(theme, { cache })
        const styler = engine.createStyler({ name: 'Box' }, [
          ({ tone, theme: view }: { tone?: number; theme: typeof theme }) => ({
            color: tone ? view.palette.primary : view.palette.text,
          }),
        ])
        const classes = [1, 0, 1, 0].map((tone) => styler.getClassName({ tone }, undefined))
        const themeClass = engine.themeClass(theme)
        const page = cache.extractPage([themeClass, ...classes]).css
        return { classes, css: cache.extract().css, page }
      })
      expect(engines[1]).toEqual(engines[0])
    })

    it('serves every page of a cache: the second page of the same contents has the rule', () => {
      const pair = createPair()
      for (const { cache } of [pair.off, pair.on]) {
        const first = cache.css({ color: 'red' })
        const page1 = extractPageStyles(cache, `<p class="${first}"></p>`).css
        const again = cache.css({ color: 'red' })
        const page2 = extractPageStyles(cache, `<p class="${again}"></p>`).css
        expect(page2).toBe(page1)
        expect(page2).toContain(`.${first}{color:red;}`)
      }
    })
  })

  describe('the wrong style: equal contents only', () => {
    it('gives a number and a string of the same text what the full path gives each', () => {
      const pairs = [
        [{ width: 1 }, { width: '1' }],
        [{ width: 0 }, { width: '0' }],
        [{ width: -0 }, { width: 0 }],
        [{ width: 1.0 }, { width: 1 }],
        [{ width: ' 1 ' }, { width: '1' }],
        [{ animationDuration: 0 }, { animationDuration: '0' }],
        [{ opacity: 1 }, { opacity: '1' }],
      ]
      for (const styles of pairs) expectSame(createPair(), callsOf(styles))
      const { on } = createPair()
      expect(on.cache.css({ width: 1 })).not.toBe(on.cache.css({ width: '1' }))
    })

    it('gives keys in another order what the full path gives each order', () => {
      const styles = [
        { margin: 0, marginLeft: 4 },
        { marginLeft: 4, margin: 0 },
        { 2: 'a', 1: 'b', color: 'red' },
      ]
      expectSame(createPair(), callsOf(styles))
      const { on } = createPair()
      expect(on.cache.css({ margin: 0, marginLeft: 4 })).not.toBe(
        on.cache.css({ marginLeft: 4, margin: 0 })
      )
    })

    it('gives a value that looks like more declarations what the full path gives', () => {
      const styles = [
        { a: 'b;c:d' },
        { a: 'b', c: 'd' },
        { 'a;c': 'd' },
        { a: '' },
        { a: '1:a' },
        { '1:a': '' },
      ]
      expectSame(createPair(), callsOf(styles))
    })

    it('keeps each layer, label and class to come after apart', () => {
      const style = { color: 'red' }
      const calls = [
        (cache: Cache) => cache.css({ ...style }),
        (cache: Cache) => cache.cssIn('overrides', { ...style }),
        (cache: Cache) => cache.cssWith({ label: 'Box' }, { ...style }),
        (cache: Cache) => cache.cssWith({ after: 'm-a' }, { ...style }),
        (cache: Cache) => cache.cssWith({ after: 'm-b' }, { ...style }),
        (cache: Cache) => cache.cssWith({ label: 'Box', after: 'm-a' }, { label: 'Inner' }, style),
      ]
      expectSame(createPair(), [...calls, ...calls])
      for (const options of [{ hasLayers: false }, { hasLabels: false }, { suffix: '-x' }]) {
        expectSame(createPair(options), [...calls, ...calls])
      }
    })

    it('gives the style of the last call to a later merge, also for what writes no rule', () => {
      const pair = createPair({ hasLabels: false })
      const styles = [
        { color: 'red', width: undefined, margin: null, padding: false },
        { color: 'red' },
        { label: 'One', color: 'red' },
        { color: 'red', '&:hover': {} },
        { color: 'red', web: { margin: 1 }, native: { margin: 2 } },
        { color: 'red', web: 'x' },
      ]
      for (const style of [...styles, ...styles]) {
        for (const { cache } of [pair.off, pair.on]) {
          const className = cache.css(raw({ ...style }))
          expect(cache.registered.get(className)).toEqual(mergeStyles([style as StyleObject]))
          cache.css(className, { margin: 3, '&:hover': { color: 'blue' } })
        }
      }
      expect(readState(pair.on)).toEqual(readState(pair.off))
    })

    it('takes the full path for what is not a plain value, and gives what it gives', () => {
      const live = createLiveValue('--m-value-1', 4, 'px')
      const styles = [
        { color: alpha('#ff0000', 0.5) },
        { width: live },
        { color: { toString: () => 'red' } },
        { display: ['block', 'grid'] },
        { '&:hover': { display: ['block', 'grid'] } },
        Object.assign(Object.create({ color: 'blue' }) as object, { margin: 0 }),
        { [Symbol('s')]: 'x', margin: 0 },
        JSON.parse('{"__proto__":{"color":"red"},"margin":0}') as object,
        { '&:hover': JSON.parse('{"__proto__":{"color":"red"},"margin":0}') as object },
      ]
      expectSame(createPair(), callsOf(styles))
    })

    it('takes the full path for class names, entries, lists and nothing at all', () => {
      const pair = createPair()
      const calls = [
        (cache: Cache) => cache.css({ color: 'red' }),
        (cache: Cache) => cache.css('m-foreign', { color: 'red' }),
        (cache: Cache) => cache.css([{ color: 'red' }, { margin: 1 }]),
        (cache: Cache) => cache.css(cache.createEntry({ color: 'blue' }), { margin: 1 }),
        (cache: Cache) => cache.css(false, null, undefined, ''),
        (cache: Cache) =>
          cache.css(
            raw(() => 'x'),
            { color: 'red' }
          ),
      ]
      expectSame(pair, [...calls, ...calls])
    })

    it('reads a getter as many times as the full path does, and gives what it gives', () => {
      const runs = [false, true].map((hasStyleMemo) => {
        const cache = createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo })
        let top = 0
        let nested = 0
        const style = () =>
          Object.defineProperties({} as StyleObject, {
            width: { get: () => ++top % 2, enumerable: true },
            '&:hover': {
              enumerable: true,
              value: Object.defineProperty({}, 'width', {
                get: () => ++nested % 3,
                enumerable: true,
              }),
            },
          })
        const classes = Array.from({ length: 6 }, () => cache.css(raw(style())))
        return { classes, top, nested, css: cache.extract().css }
      })
      expect(runs[1]).toEqual(runs[0])
    })

    it('names the right class after it was emptied, with the rule in the sheet', () => {
      const pair = createPair()
      // Each style twice: the second call remembers it, so the memo fills and is emptied.
      const calls = Array.from({ length: contentMemo.CONTENT_STEP_LIMIT + 50 }, (_, index) => {
        const call = (cache: Cache) => cache.css({ left: index % 7 === 0 ? 0 : index })
        return [call, call]
      }).flat()
      expectSame(pair, calls)
      expect(pair.on.cache.css({ left: 1 })).toBe(pair.off.cache.css({ left: 1 }))
      expect(pair.on.sheet.rules.filter((rule) => rule.endsWith('{left:1px;}}'))).toHaveLength(1)
    })

    it('remembers a style the second time it comes, not the first', () => {
      vi.mocked(contentMemo.readStableStyle).mockClear()
      const { on } = createPair()
      on.cache.css({ left: 1 })
      expect(contentMemo.readStableStyle).not.toHaveBeenCalled()
      on.cache.css({ left: 1 })
      expect(contentMemo.readStableStyle).toHaveBeenCalledTimes(1)
      on.cache.css({ left: 1 })
      expect(contentMemo.readStableStyle).toHaveBeenCalledTimes(1)
      on.cache.css({})
      expect(contentMemo.readStableStyle).toHaveBeenCalledTimes(2)
    })
  })

  it('is not used with the development checks, which warn on every call as before', () => {
    vi.mocked(contentMemo.createContentMemo).mockClear()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const messages = [false, true].map((hasStyleMemo) => {
      warn.mockClear()
      const cache = createCache({
        prefix: 'm',
        sheet: createMemorySheet(),
        hasDevChecks: true,
        hasStyleMemo,
      })
      for (const width of [Number.NaN, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
        cache.css({ width, color: 'red' })
      }
      return warn.mock.calls.map(([message]) => message as string)
    })
    warn.mockRestore()
    expect(messages[1]).toEqual(messages[0])
    expect(messages[0]).not.toEqual([])
    expect(contentMemo.createContentMemo).not.toHaveBeenCalled()
  })

  it('is not used with value repair, whose compile reads the values of the tokens', () => {
    vi.mocked(contentMemo.createContentMemo).mockClear()
    const cache = createCache({ prefix: 'm', sheet: createMemorySheet(), hasStyleMemo: true })
    cache.withStyleOptions({ hasValueRepair: true }).css({ width: 'var(--x)px' })
    createCache({ prefix: 'm', hasValueRepair: true, hasStyleMemo: true }).css({ width: 1 })
    expect(contentMemo.createContentMemo).toHaveBeenCalledTimes(1)
  })
})
