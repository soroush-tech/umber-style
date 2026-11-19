import { createCache, createMemorySheet } from './cache'
import { createDevChecker, isDevelopment } from './devChecks'

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
