import { createCache, createMemorySheet } from './cache'
import { createDevChecker, isDevelopment, isProduction } from './devChecks'
import type { GlobalStyleObject } from './globalStyles'
import type { WebStyleObject } from './webStyle'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function addStyle(css: string) {
  const element = document.createElement('style')
  element.setAttribute('data-style', 'u')
  element.textContent = css
  document.head.appendChild(element)
}

/** What a message about a NaN value ends with. */
const NAN_HINT =
  ' A NaN often comes from arithmetic on a token in a style function (theme.space[2] * 2), where the token is a reference such as var(--x), not a number: use multiply() or calc(), give the token a raw or inline mode (modes), or read the real value from useTheme().'

describe('isDevelopment', () => {
  it('is true for a development build only', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isDevelopment()).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isDevelopment()).toBe(false)
    vi.stubEnv('NODE_ENV', 'test')
    expect(isDevelopment()).toBe(false)
  })

  it('is false where there is no process', () => {
    vi.stubGlobal('process', undefined)
    expect(isDevelopment()).toBe(false)
  })
})

describe('isProduction', () => {
  it('is true for a production build only', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isProduction()).toBe(true)
    vi.stubEnv('NODE_ENV', 'test')
    expect(isProduction()).toBe(false)
  })

  it('is true where there is no process', () => {
    vi.stubGlobal('process', undefined)
    expect(isProduction()).toBe(true)
  })
})

describe('the development checker', () => {
  it('warns once for each problem, after the calls have stopped', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    addStyle('.u-a{color:red;}')
    document.body.innerHTML = '<p data-testid="p" class="u-a u-missing"></p>'
    const check = createDevChecker('u', 100)
    check()
    check()
    check()
    vi.advanceTimersByTime(99)
    expect(warn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[u] p[p] has the class u-missing, which no rule names')
    check()
    vi.advanceTimersByTime(100)
    expect(warn).toHaveBeenCalledTimes(1)
    document.body.innerHTML = '<p data-testid="q" class="u-other"></p>'
    check()
    vi.advanceTimersByTime(100)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('says nothing for a page that is fine', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    addStyle('.u-a{color:red;}')
    document.body.innerHTML = '<p class="u-a"></p>'
    createDevChecker('u')()
    vi.advanceTimersByTime(1000)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the development checker, for declarations the browser does not support', () => {
  /** A style with what the web types do not have, as a style shared with React Native may hold. */
  const untyped = (style: object) => style as WebStyleObject

  /** A browser whose CSS.supports knows `color` and `display`, and no value that starts with `no`. */
  function stubBrowser() {
    const known = new Set(['color', 'display'])
    const supports = vi.fn(
      (property: string, value: string) => known.has(property) && !value.startsWith('no')
    )
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    vi.stubGlobal('CSS', { supports })
    return supports
  }

  it('warns once for each message, in the run after the calls have stopped', () => {
    vi.useFakeTimers()
    stubBrowser()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const check = createDevChecker('u', 100)
    check(['.u-a{color:red;elevation:2px}'])
    check(['.u-b{display:nope;display:flex;-webkit-x:1;--u-x:nope}'])
    vi.advanceTimersByTime(99)
    expect(warn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(warn.mock.calls).toEqual([
      ['[u] the class u-a declares elevation:2px, which this browser does not support'],
    ])
    check(['.u-a{elevation:2px}', '.u-c{elevation:2px}'])
    vi.advanceTimersByTime(100)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenLastCalledWith(
      '[u] the class u-c declares elevation:2px, which this browser does not support'
    )
  })

  it('keeps nothing and asks nothing where the browser cannot be asked', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // jsdom: its CSS.supports is not asked.
    const check = createDevChecker('u', 100)
    check(['.u-a{elevation:2px}'])
    vi.advanceTimersByTime(100)
    vi.stubGlobal('CSS', undefined)
    const other = createDevChecker('u', 100)
    other(['.u-a{elevation:2px}'])
    vi.advanceTimersByTime(100)
    expect(warn).not.toHaveBeenCalled()
  })

  it('is run by a cache for the rules it inserts and the global rules it writes, in development only', () => {
    vi.useFakeTimers()
    const supports = stubBrowser()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    const quiet = createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    quiet.css(untyped({ elevation: 2 }))
    vi.advanceTimersByTime(1000)
    expect(warn).not.toHaveBeenCalled()
    expect(supports).not.toHaveBeenCalled()

    vi.stubEnv('NODE_ENV', 'development')
    const cache = createCache({ prefix: 'u', sheet: createMemorySheet() })
    const name = cache.css(untyped({ elevation: 2, color: 'red' }))
    cache.insertGlobal(cache.compileGlobal({ body: untyped({ display: 'nope' }) }))
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls).toEqual([
      [`[u] the class ${name} declares elevation:2px, which this browser does not support`],
      ['[u] the global rule body declares display:nope, which this browser does not support'],
    ])
  })
})

describe('a cache with development checks', () => {
  it('checks after its first read of the page and after it inserts rules', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    document.body.innerHTML = '<p class="u-orphan"></p>'
    const cache = createCache({
      prefix: 'u',
      hasLayers: false,
      hasDevChecks: true,
      sheet: createMemorySheet(),
    })
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('u-orphan'))
    // A rule is inserted: the page is looked at again, and the same problem is not told twice.
    document.body.innerHTML = '<p class="u-orphan u-second"></p>'
    cache.css({ color: 'blue' })
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('u-second'))
  })

  it('checks when a style element arrives in the head', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    document.body.innerHTML = '<p class="u-late"></p>'
    createCache({ prefix: 'u', hasLayers: false, hasDevChecks: true, sheet: createMemorySheet() })
    const element = document.createElement('style')
    element.dataset.precedence = 'u'
    element.textContent = '.u-other{color:red;}'
    document.head.appendChild(element)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('u-late'))
  })

  it('is off by default in a test run, on in development, and off with the option', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    document.body.innerHTML = '<p class="u-orphan"></p>'
    addStyle('.u-x{color:red;}')
    createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    vi.advanceTimersByTime(1000)
    expect(warn).not.toHaveBeenCalled()

    vi.stubEnv('NODE_ENV', 'development')
    createCache({ prefix: 'u', hasLayers: false, hasDevChecks: false, sheet: createMemorySheet() })
    vi.advanceTimersByTime(1000)
    expect(warn).not.toHaveBeenCalled()
    createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

/** A style with what the types do not let through, as plain JavaScript can write it. */
const untypedStyle = (style: object) => style as WebStyleObject & GlobalStyleObject

describe('the report of values that no CSS property takes', () => {
  it('fires in a test run with hasDevChecks, once for each message, for classes, entries and global styles', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({
      prefix: 'u',
      hasLayers: false,
      hasDevChecks: true,
      sheet: createMemorySheet(),
    })
    const name = cache.cssWith(
      { label: 'Card-root' },
      untypedStyle({ width: true, '&:hover': { color: () => 'red' } })
    )
    cache.cssWith(
      { label: 'Card-root' },
      untypedStyle({ width: true, '&:hover': { color: () => 'red' } })
    )
    const entry = cache.createEntry(untypedStyle({ margin: Number.NaN }))
    const plain = entry.className
    cache.compileGlobal(
      untypedStyle({
        body: [{ margin: Number.NaN }, entry],
        html: null,
        '@media print': { main: { display: ['block', {}] } },
      })
    )
    expect(warn.mock.calls).toEqual([
      [
        `[u] the class ${name} of "Card-root" declares "width" as true, which is never a CSS value: give a string or a number.`,
      ],
      [
        `[u] the class ${name} of "Card-root" declares "color" as a function, which is never a CSS value: give a string or a number.`,
      ],
      [
        `[u] the class ${plain} declares "margin" as NaN, which is never a CSS value: give a string or a number.${NAN_HINT}`,
      ],
      [
        `[u] the global rule body declares "margin" as NaN, which is never a CSS value: give a string or a number.${NAN_HINT}`,
      ],
      [
        '[u] the global rule @media print declares "display" as an object in a list of values, which is never a CSS value: give a string or a number.',
      ],
    ])
  })

  it('says nothing without the development checks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    cache.css(untypedStyle({ width: true }))
    cache.compileGlobal(untypedStyle({ body: { margin: true } }))
    expect(warn).not.toHaveBeenCalled()
    expect(cache.hasDevChecks).toBe(false)
  })
})

describe('the label of a class in a message of the browser check', () => {
  it('names the component of a class that has a label, capitals kept', () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    vi.stubGlobal('CSS', {
      supports: (_property: string, value: string) => value !== 'light' && value !== 'not-a-color',
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({
      prefix: 'u',
      hasLayers: false,
      hasDevChecks: true,
      sheet: createMemorySheet(),
    })
    const name = cache.cssWith({ label: 'Button-root' }, { borderColor: 'light' })
    // A class that the cache did not make from a style has no label.
    cache.insertOnce('u-raw', ['.u-raw{border-color:light;}'])
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls).toEqual([
      [
        `[u] the class ${name} of "Button-root" declares border-color:light, which this browser does not support`,
      ],
      ['[u] the class u-raw declares border-color:light, which this browser does not support'],
    ])
  })
})
