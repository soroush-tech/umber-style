import { createCache, createDomSheet } from './cache'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A page of its own, with `markup` in its body: the check of a prefix is shared by page. */
function createPage(markup: string): Document {
  const page = document.implementation.createHTMLDocument('')
  page.body.innerHTML = markup
  return page
}

/** A cache of `prefix` that writes into `page`, with the development checks. */
function createPageCache(prefix: string, page: Document) {
  return createCache({
    prefix,
    hasLayers: false,
    hasDevChecks: true,
    sheet: createDomSheet(prefix, page.head, { speedy: true }),
  })
}

describe('the development check of a page, shared by the caches of a prefix', () => {
  it('tells each problem once for two caches of one prefix', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const page = createPage('<p class="u-missing"></p>')
    const first = createPageCache('u', page)
    const second = createPageCache('u', page)
    first.css({ color: 'red' })
    second.css({ color: 'blue' })
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls).toEqual([
      [
        '[u] p[] has the class u-missing, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule',
      ],
    ])
  })

  it('checks the page for each prefix on its own', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const page = createPage('<p class="u-missing v-missing"></p>')
    createPageCache('u', page)
    createPageCache('v', page)
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls.flat().sort()).toEqual([
      '[u] p[] has the class u-missing, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule',
      '[v] p[] has the class v-missing, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule',
    ])
  })

  it('still checks with a cache made after another one is gone, and tells a problem told before no more', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const page = createPage('<p class="u-first"></p>')
    createPageCache('u', page).css({ color: 'red' })
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(1)
    page.body.innerHTML = '<p class="u-first u-second"></p>'
    createPageCache('u', page).css({ color: 'blue' })
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls).toEqual([
      [
        '[u] p[] has the class u-first, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule',
      ],
      [
        '[u] p[] has the class u-second, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule',
      ],
    ])
  })

  it('asks the browser about the rules of every cache, each named with the labels of its own classes', () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    vi.stubGlobal('CSS', {
      supports: (_property: string, value: string) => value !== 'light' && value !== 'not-a-color',
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const page = createPage('')
    const first = createPageCache('u', page)
    const second = createPageCache('u', page)
    const button = first.cssWith({ label: 'Button-root' }, { borderColor: 'light' })
    const card = second.cssWith({ label: 'Card-root' }, { outlineColor: 'light' })
    // The same class from both caches is told once.
    second.cssWith({ label: 'Button-root' }, { borderColor: 'light' })
    vi.advanceTimersByTime(1000)
    expect(warn.mock.calls).toEqual([
      [
        `[u] the class ${button} of "Button-root" declares border-color:light, which this browser does not support`,
      ],
      [
        `[u] the class ${card} of "Card-root" declares outline-color:light, which this browser does not support`,
      ],
    ])
  })
})
