import { createCache, createDomSheet, createMemorySheet, type Sheet } from './cache'
import { createStyleTag, extractPageStyles } from './extractStyles'
import type { GlobalStyleObject } from './globalStyles'
import { keyframes } from './keyframes'
import { createThemeClass } from './theme'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup(options: { hasLayers?: boolean; hasPruning?: boolean; sheet?: Sheet } = {}) {
  const sheet = options.sheet ?? createMemorySheet()
  const cache = createCache({ prefix: 'u', ...options, sheet })
  /** Inserts `styles` as one set of global rules, and returns its release. */
  const insert = (styles: GlobalStyleObject) => cache.insertGlobal(cache.compileGlobal(styles))
  return { cache, sheet, insert }
}

const reset: GlobalStyleObject = { body: { margin: 0 } }
const app: GlobalStyleObject = { body: { color: 'red' }, '#root': { isolation: 'isolate' } }

describe('global rules in a cache', () => {
  it('are compiled into the global layer with an id that their rules make, and written nowhere', () => {
    const { cache, sheet } = setup()
    const global = cache.compileGlobal(reset)
    expect(global).toEqual({
      id: expect.stringMatching(/^u-global-[0-9a-z]+$/),
      rules: ['@layer u-global{body{margin:0;}}'],
      animations: [],
    })
    expect(cache.compileGlobal({ body: { margin: 0 } }).id).toBe(global.id)
    expect(cache.compileGlobal({ body: { margin: 1 } }).id).not.toBe(global.id)
    expect(sheet.rules).toEqual([])
  })

  it('are written after the layer order, once for each id however many times they are inserted, and removed at the last release', () => {
    const { cache, sheet, insert } = setup()
    const first = insert(reset)
    const second = insert({ body: { margin: 0 } })
    expect(sheet.rules).toEqual([cache.layerOrder, '@layer u-global{body{margin:0;}}'])
    first()
    first()
    expect(sheet.rules).toHaveLength(2)
    second()
    expect(sheet.rules).toEqual([cache.layerOrder])
    // Inserted again, they are written again.
    insert(reset)
    expect(sheet.rules).toEqual([cache.layerOrder, '@layer u-global{body{margin:0;}}'])
  })

  it('keep the order of insertion, and a set inserted again after its removal goes last', () => {
    const { sheet, insert } = setup({ hasLayers: false })
    const releaseReset = insert(reset)
    insert(app)
    expect(sheet.rules).toEqual([
      'body{margin:0;}',
      'body{color:red;}',
      '#root{isolation:isolate;}',
    ])
    releaseReset()
    insert(reset)
    expect(sheet.rules).toEqual([
      'body{color:red;}',
      '#root{isolation:isolate;}',
      'body{margin:0;}',
    ])
  })

  it('are written outside every layer without layers, among the other rules in the order they come', () => {
    const { cache, sheet, insert } = setup({ hasLayers: false })
    const name = cache.css({ color: 'blue' })
    insert(reset)
    expect(sheet.rules).toEqual([`.${name}{color:blue;}`, 'body{margin:0;}'])
  })

  it('write nothing for styles with no rule, and release them all the same', () => {
    const { cache, sheet, insert } = setup()
    const release = insert({ body: {} })
    expect(sheet.rules).toEqual([])
    release()
    expect(cache.extract().ids).toEqual([])
  })

  it('leave the theme rules replaceable at their places after a removal', () => {
    const { cache, sheet, insert } = setup({ hasLayers: false })
    const light = createThemeClass(cache, { '--u-a': '1' }, { colorScheme: 'light' })
    const release = insert({ html: { color: 'red' }, body: { color: 'blue' } })
    const dark = createThemeClass(cache, { '--u-a': '10' }, { colorScheme: 'dark' })
    expect(sheet.rules).toEqual([
      `.${light}{color-scheme:light;}`,
      'html{color:red;}',
      'body{color:blue;}',
      `.${dark}{color-scheme:dark;}`,
    ])
    release()
    const name = cache.css({ color: 'var(--u-a)' })
    expect(sheet.rules).toEqual([
      `.${light}{--u-a:1;color-scheme:light;}`,
      `.${dark}{--u-a:10;color-scheme:dark;}`,
      `.${name}{color:var(--u-a);}`,
    ])
  })

  it('stay in a sheet that cannot remove, and count as written', () => {
    const rules: string[] = []
    const sheet: Sheet = { rules, insert: (rule) => void rules.push(rule) }
    const { cache, insert } = setup({ hasLayers: false, sheet })
    const global = cache.compileGlobal(reset)
    insert(reset)()
    expect(rules).toEqual(['body{margin:0;}'])
    insert(reset)
    expect(rules).toEqual(['body{margin:0;}'])
    expect(cache.extract().ids).toContain(global.id)
  })

  it('remove only the rules that the sheet took', () => {
    const rules: string[] = []
    const sheet: Sheet = {
      rules,
      insert: (rule) => void (rule.includes('bad') || rules.push(rule)),
      remove: (index) => void rules.splice(index, 1),
    }
    const { insert } = setup({ hasLayers: false, sheet })
    insert({ p: { color: 'red' } })
    const release = insert({ html: { color: 'bad' }, body: { color: 'blue' } })
    expect(rules).toEqual(['p{color:red;}', 'body{color:blue;}'])
    release()
    expect(rules).toEqual(['p{color:red;}'])
  })

  it('mark the variables they use, so a pruned theme class declares them', () => {
    const { cache, sheet, insert } = setup({ hasLayers: false })
    const theme = createThemeClass(cache, { '--u-a': 'red', '--u-b': 'blue' })
    insert({ body: { color: 'var(--u-a)' } })
    expect(sheet.rules).toEqual(['body{color:var(--u-a);}', `.${theme}{--u-a:red;}`])
  })
})

describe('global rules in a browser sheet', () => {
  const texts = (element: HTMLStyleElement) =>
    [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText.replace(/\s+/g, ''))

  it('are deleted from the style element where they are at the time, written by insertRule', () => {
    const sheet = createDomSheet('u', undefined, { speedy: true })
    const { cache, insert } = setup({ hasLayers: false, sheet })
    const releaseReset = insert(reset)
    // The element of the sheet is made at its first rule.
    const element = document.querySelector('style[data-style="u"]') as HTMLStyleElement
    const releaseApp = insert(app)
    cache.css({ color: 'blue' })
    // A rule that someone else puts in front does not move what the sheet removes.
    ;(element.sheet as CSSStyleSheet).insertRule('main{order:1;}', 0)
    releaseReset()
    expect(texts(element)).toEqual([
      'main{order:1;}',
      'body{color:red;}',
      '#root{isolation:isolate;}',
      expect.stringMatching(/^\.u-\w+\{color:blue;\}$/),
    ])
    // A rule that someone else deleted is left as it is.
    ;(element.sheet as CSSStyleSheet).deleteRule(1)
    releaseApp()
    expect(texts(element)).toEqual(['main{order:1;}', expect.stringMatching(/color:blue/)])
    expect(cache.extract().css).toMatch(/^\.u-\w+\{color:blue;\}$/)
  })

  it('leave the page with their style elements when released, written by text', () => {
    const sheet = createDomSheet('u', undefined, { speedy: false })
    const { cache, insert } = setup({ hasLayers: false, sheet })
    const readElements = () => [
      ...document.querySelectorAll<HTMLStyleElement>('style[data-style="u"]'),
    ]
    const releaseReset = insert(reset)
    const releaseApp = insert(app)
    const name = cache.css({ color: 'blue' })
    releaseReset()
    expect(readElements().map((element) => element.textContent)).toEqual([
      'body{color:red;}',
      '#root{isolation:isolate;}',
      `.${name}{color:blue;}`,
    ])
    releaseApp()
    expect(readElements().map((element) => element.textContent)).toEqual([`.${name}{color:blue;}`])
    expect(readElements().flatMap(texts)).toEqual([`.${name}{color:blue;}`])
  })
})

describe('keyframes used by global rules', () => {
  const glow = keyframes({ to: { opacity: 0.5 } }, { label: 'glow' })
  const glowRule = `@keyframes ${glow}{100%{opacity:0.5;}}`

  it('are written before them and stay after their release', () => {
    const { cache, sheet, insert } = setup()
    const global = cache.compileGlobal({ body: { animation: `${glow} 1s` } })
    expect(global.animations).toEqual([glow])
    const release = insert({ body: { animation: `${glow} 1s` } })
    expect(sheet.rules).toEqual([
      cache.layerOrder,
      glowRule,
      `@layer u-global{body{animation:${glow} 1s;}}`,
    ])
    release()
    expect(sheet.rules).toEqual([cache.layerOrder, glowRule])
  })

  it('are in the css of every page while the global rules are', () => {
    const { cache, insert } = setup({ hasLayers: false })
    const release = insert({ body: { animationName: glow } })
    expect(cache.extractPage([]).css).toBe(`${glowRule}body{animation-name:${glow};}`)
    expect(cache.extractPage([], { carried: new Set([glow]) }).css).toBe(
      `body{animation-name:${glow};}`
    )
    release()
    expect(cache.extractPage([]).css).toBe('')
  })
})

describe('global rules in the extracted css', () => {
  it('are in extract while they are held, and their ids with them', () => {
    const { cache, insert } = setup({ hasLayers: false })
    const name = cache.css({ color: 'blue' })
    const release = insert(reset)
    const { id } = cache.compileGlobal(reset)
    expect(cache.extract()).toEqual({
      css: `.${name}{color:blue;}body{margin:0;}`,
      ids: [name, id],
    })
    release()
    expect(cache.extract()).toEqual({ css: `.${name}{color:blue;}`, ids: [name] })
  })

  it('are in the css of every page, after the themes and before the classes, in the order they were inserted', () => {
    const { cache, insert } = setup()
    const theme = createThemeClass(cache, { '--u-a': 'red', '--u-b': 'blue', '--u-c': 'green' })
    const name = cache.css({ color: 'var(--u-b)' })
    insert(app)
    insert({ html: { background: 'var(--u-a)' } })
    const resetId = cache.compileGlobal(app).id
    const htmlId = cache.compileGlobal({ html: { background: 'var(--u-a)' } }).id
    expect(cache.extractPage([]).css).toBe(
      `${cache.layerOrder}@layer u-global{body{color:red;}}@layer u-global{#root{isolation:isolate;}}@layer u-global{html{background:var(--u-a);}}`
    )
    const page = cache.extractPage([name, theme])
    expect(page.css).toBe(
      cache.layerOrder +
        `@layer u-theme{.${theme}{--u-a:red;--u-b:blue;}}` +
        '@layer u-global{body{color:red;}}@layer u-global{#root{isolation:isolate;}}' +
        '@layer u-global{html{background:var(--u-a);}}' +
        `@layer u-components{.${name}{color:var(--u-b);}}`
    )
    expect(page.ids).toEqual([theme, resetId, htmlId, name])
    // A theme of a page with no class still declares what the global rules use.
    expect(cache.extractPage([theme]).css).toContain(`.${theme}{--u-a:red;}`)
  })

  it('are left out when the document carries them', () => {
    const { cache, insert } = setup({ hasLayers: false })
    insert(reset)
    insert(app)
    const { id } = cache.compileGlobal(reset)
    const page = cache.extractPage([], { carried: new Set([id]) })
    expect(page.css).toBe('body{color:red;}#root{isolation:isolate;}')
    expect(page.ids).toEqual([cache.compileGlobal(app).id])
  })

  it('are what extractPageStyles writes for any page', () => {
    const { cache, insert } = setup({ hasLayers: false })
    const name = cache.css({ color: 'blue' })
    insert(reset)
    expect(extractPageStyles(cache, '<p></p>').css).toBe('body{margin:0;}')
    expect(extractPageStyles(cache, `<p class="${name}"></p>`).css).toBe(
      `body{margin:0;}.${name}{color:blue;}`
    )
  })
})

describe('global rules that a component rendered', () => {
  const glow = keyframes({ to: { opacity: 0.4 } }, { label: 'rendered' })

  function setupPages() {
    const { cache } = setup({ hasLayers: false })
    /** Inserts `styles` as a component does, and returns the id and the release. */
    const render = (styles: GlobalStyleObject) => {
      const global = cache.compileGlobal(styles)
      return { id: global.id, release: cache.insertGlobal(global, { isRendered: true }) }
    }
    return { cache, render }
  }

  it('are in a page only when it names them or carries them, with the animations they use', () => {
    const { cache, render } = setupPages()
    const promo = render({ nav: { animationName: glow } })
    const base = render(reset)
    expect(cache.extractPage([]).css).toBe('')
    expect(cache.extractPage([], { rendered: new Set([base.id]) }).css).toBe('body{margin:0;}')
    expect(cache.extractPage([], { rendered: new Set([promo.id, base.id]) })).toEqual({
      css: `@keyframes ${glow}{100%{opacity:0.4;}}nav{animation-name:${glow};}body{margin:0;}`,
      ids: [promo.id, base.id],
    })
    // A carried set is not written again, and the animation it uses is still the page's.
    expect(cache.extractPage([], { carried: new Set([promo.id]) }).css).toBe(
      `@keyframes ${glow}{100%{opacity:0.4;}}`
    )
    // The whole cache still holds them.
    expect(cache.extract().css).toContain('nav{')
  })

  it('are in every page while one insertion of the same set is for the app', () => {
    const { cache, render } = setupPages()
    const { id } = render(reset)
    const releaseApp = cache.insertGlobal(cache.compileGlobal(reset))
    expect(cache.extractPage([]).css).toBe('body{margin:0;}')
    releaseApp()
    expect(cache.extractPage([]).css).toBe('')
    expect(cache.extractPage([], { rendered: new Set([id]) }).css).toBe('body{margin:0;}')
  })

  it('are what extractPageStyles writes for the page whose markup names them', () => {
    const { cache, render } = setupPages()
    const promo = render({ nav: { outline: 'none' } })
    render(reset)
    const app = cache.insertGlobal(cache.compileGlobal({ html: { color: 'red' } }))
    const marked = `<meta name="u-global" content="${promo.id}"><p></p>`
    expect(extractPageStyles(cache, marked).css).toBe('nav{outline:none;}html{color:red;}')
    expect(extractPageStyles(cache, `<!--u-global ${promo.id}--><p></p>`).css).toBe(
      'nav{outline:none;}html{color:red;}'
    )
    expect(extractPageStyles(cache, '<p></p>').css).toBe('html{color:red;}')
    app()
  })
})

describe('global rules on a page that a server rendered', () => {
  function render(styles: readonly GlobalStyleObject[], hasLayers = true) {
    const server = setup({ hasLayers })
    for (const one of styles) server.insert(one)
    return server.cache
  }

  /** The rules of the page's style elements, as the browser holds them. */
  const pageRules = () =>
    [...document.querySelectorAll('style')].flatMap((element) =>
      [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText.replace(/\s+/g, ''))
    )

  it('are taken over, not written again, and removed from the page when released', () => {
    document.head.innerHTML = createStyleTag(render([reset, app]))
    const { sheet, insert } = setup()
    const releaseApp = insert(app)
    const releaseReset = insert(reset)
    expect(sheet.rules).toEqual([])
    releaseApp()
    expect(pageRules()).toEqual([
      '@layeru-theme,u-global,u-components,u-overrides;',
      '@layeru-global{body{margin:0px;}}',
    ])
    releaseReset()
    expect(pageRules()).toEqual(['@layeru-theme,u-global,u-components,u-overrides;'])
    // Inserted again, they are written by the cache.
    insert(reset)
    expect(sheet.rules).toEqual(['@layer u-global{body{margin:0;}}'])
  })

  it('are taken from style elements of their own, as a server component sends them', () => {
    const server = render([reset])
    const { id, rules } = server.compileGlobal(reset)
    const element = document.createElement('style')
    element.dataset.precedence = 'u'
    element.dataset.href = id
    element.textContent = [server.layerOrder, ...rules].join('')
    document.head.appendChild(element)
    const { sheet, insert } = setup()
    insert(reset)()
    expect(sheet.rules).toEqual([])
    expect(pageRules()).toEqual(['@layeru-theme,u-global,u-components,u-overrides;'])
  })

  it('are taken from a style element that arrived in the same task, before the watch reported it', () => {
    const server = render([reset])
    const { id, rules } = server.compileGlobal(reset)
    const { sheet, insert } = setup()
    // React puts the element of a server component's payload in the head in the commit that mounts it.
    const element = document.createElement('style')
    element.dataset.precedence = 'u'
    element.dataset.href = id
    element.textContent = [server.layerOrder, ...rules].join('')
    document.head.appendChild(element)
    insert(reset)()
    expect(sheet.rules).toEqual([])
    expect(pageRules()).toEqual(['@layeru-theme,u-global,u-components,u-overrides;'])
  })

  it('are read from a streamed style element once React moved it from the body to the head', async () => {
    const server = render([reset])
    const { id, rules } = server.compileGlobal(reset)
    const { sheet, insert } = setup()
    // React's stream sends the element of a late boundary into the body, applying to nothing, and its
    // script moves it to the head when the boundary is revealed, which parses its rules again.
    const element = document.createElement('style')
    element.setAttribute('media', 'not all')
    element.dataset.precedence = 'u'
    element.dataset.href = id
    element.textContent = [server.layerOrder, ...rules].join('')
    document.body.appendChild(element)
    await new Promise((resolve) => setTimeout(resolve, 0))
    element.removeAttribute('media')
    document.head.appendChild(element)
    const release = insert(reset)
    expect(sheet.rules).toEqual([])
    release()
    expect(pageRules()).toEqual(['@layeru-theme,u-global,u-components,u-overrides;'])
  })

  it('are written when the page has only some of their rules', () => {
    document.head.innerHTML = createStyleTag(render([{ body: { color: 'red' } }], false))
    const { sheet, insert } = setup({ hasLayers: false })
    insert(app)
    expect(sheet.rules).toEqual(['body{color:red;}', '#root{isolation:isolate;}'])
  })

  it('stay on the page when the browser did not keep every rule of its text', () => {
    const tag = createStyleTag(render([reset], false))
    document.head.innerHTML = tag.replace('</style>', '@unknown{}</style>')
    const { cache, sheet, insert } = setup({ hasLayers: false })
    insert(reset)()
    expect(pageRules()).toEqual(['body{margin:0px;}'])
    insert(reset)
    expect(sheet.rules).toEqual([])
    expect(cache.extract().ids).toContain(cache.compileGlobal(reset).id)
  })

  it('stay when their element has no sheet, and are left when someone else removed them', async () => {
    const element = document.createElement('style')
    element.dataset.precedence = 'u'
    element.textContent = 'body{margin:0;}'
    document.head.appendChild(element)
    const { sheet, insert } = setup({ hasLayers: false })
    // An element that arrives and is gone before it is read has no sheet.
    const late = document.createElement('style')
    late.dataset.precedence = 'u'
    late.textContent = '#root{isolation:isolate;}'
    document.head.appendChild(late)
    late.remove()
    await new Promise((resolve) => setTimeout(resolve, 0))
    insert({ '#root': { isolation: 'isolate' } })()
    expect(sheet.rules).toEqual([])
    ;(element.sheet as CSSStyleSheet).deleteRule(0)
    expect(() => insert(reset)()).not.toThrow()
    expect(sheet.rules).toEqual([])
  })
})

describe('the development check of global rules', () => {
  it('warns once when a rule for body uses a variable that nothing above it declares', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'u', hasDevChecks: true, sheet: createDomSheet('u') })
    cache.insertGlobal(cache.compileGlobal({ body: { background: 'var(--u-bg)' } }))
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[u] body[] has no value for --u-bg, which the global rule body uses: a rule for html or body sees the variables of a theme declared on :root (the outermost provider) or on <html> (its theme class)'
    )
    cache.css({ color: 'red' })
    vi.advanceTimersByTime(1000)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
