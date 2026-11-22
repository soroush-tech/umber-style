import { createCache, createDomSheet, createMemorySheet, type CacheOptions } from './cache'
import { keyframes } from './keyframes'

afterEach(() => {
  document.head.innerHTML = ''
  vi.restoreAllMocks()
})

describe('createCache', () => {
  it('inserts the same style once', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, sheet })
    const first = cache.css({ color: 'red' })
    const second = cache.css({ color: 'red' })
    expect(second).toBe(first)
    expect(sheet.rules).toEqual([`.${first}{color:red;}`])
  })

  it('makes one new class from several cache classes, the last winning', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, sheet })
    const a = cache.css({ color: 'red', margin: 1 })
    const b = cache.css({ color: 'blue' })
    const merged = cache.css(a, b)
    expect(merged.split(' ')).toHaveLength(1)
    expect(merged).not.toBe(a)
    expect(merged).not.toBe(b)
    expect(sheet.rules.at(-1)).toBe(`.${merged}{margin:1px;color:blue;}`)
  })

  it('returns the same class for a single cache class', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    const a = cache.css({ color: 'red' })
    expect(cache.css(a)).toBe(a)
  })

  it('passes other class names through in front of the new class', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    const result = cache.css('  plain other ', { color: 'red' }, null, undefined, false)
    const [plain, other, made] = result.split(' ')
    expect([plain, other]).toEqual(['plain', 'other'])
    expect(cache.registered.has(made)).toBe(true)
  })

  it('returns only the raw classes, or an empty string, when there is no style', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    expect(cache.css('a  b')).toBe('a b')
    expect(cache.css()).toBe('')
    expect(cache.css('', null)).toBe('')
  })

  it('names a class with prefix, label, hash and suffix', () => {
    const cache = createCache({
      hasLayers: false,
      prefix: 'ds',
      suffix: '-x',
      sheet: createMemorySheet(),
    })
    expect(cache.css({ label: 'button-root', color: 'red' })).toMatch(
      /^ds-button-root-[a-z0-9]+-x$/
    )
  })

  it('drops the label when hasLabels is false', () => {
    const cache = createCache({
      hasLayers: false,
      prefix: 'ds',
      hasLabels: false,
      sheet: createMemorySheet(),
    })
    expect(cache.css({ label: 'button-root', color: 'red' })).toMatch(/^ds-[a-z0-9]+$/)
  })

  it('omits the label part when a style has none', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    expect(cache.css({ color: 'red' })).toMatch(/^css-[a-z0-9]+$/)
  })

  it('throws for an invalid prefix', () => {
    expect(() => createCache({ prefix: 'Bad Prefix' })).toThrow(/Invalid cache prefix/)
    expect(() => createCache({ prefix: '1a' })).toThrow()
  })

  it('inserts once under an id and says whether it did', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, sheet })
    expect(cache.insertOnce('x', ['a{}', 'b{}'])).toBe(true)
    expect(cache.insertOnce('x', ['c{}'])).toBe(false)
    expect(sheet.rules).toEqual(['a{}', 'b{}'])
  })

  it('extracts the css and the ids', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    const name = cache.css({ color: 'red' })
    cache.insertOnce('other', ['p{x:y;}'])
    expect(cache.extract()).toEqual({ css: `.${name}{color:red;}p{x:y;}`, ids: [name, 'other'] })
  })

  it('treats the classes that the rules of a server-rendered style element name as inserted', () => {
    const element = document.createElement('style')
    element.setAttribute('data-style', 'css')
    element.textContent = '.css-one{color:red;}.css-two:hover{color:blue;}'
    document.head.appendChild(element)
    const sheet = createMemorySheet()
    const cache = createCache({ hasLayers: false, sheet })
    expect(cache.insertOnce('css-one', ['a{}'])).toBe(false)
    expect(cache.insertOnce('css-two', ['a{}'])).toBe(false)
    expect(cache.insertOnce('css-three', ['b{}'])).toBe(true)
    expect(cache.extract().ids).toEqual(['css-one', 'css-two', 'css-three'])
  })

  it('uses a DOM sheet by default where there is a document', () => {
    const cache = createCache({ hasLayers: false })
    const name = cache.css({ color: 'red' })
    const element = document.querySelector<HTMLStyleElement>('style[data-style="css"]')
    expect(element?.sheet?.cssRules).toHaveLength(1)
    expect(cache.extract().css).toBe(`.${name}{color:red;}`)
  })
})

/** The rules of the style elements `data-style="<key>"`, as the document parsed them, in document order. */
function readRuleTexts(key: string): string[] {
  return [...document.querySelectorAll<HTMLStyleElement>(`style[data-style="${key}"]`)].flatMap(
    (element) => [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText)
  )
}

/** The text of the style elements `data-style="<key>"`, joined in document order. */
function readStyleText(key: string): string {
  return [...document.querySelectorAll(`style[data-style="${key}"]`)]
    .map((element) => element.textContent)
    .join('')
}

const RULE_MODES = [
  { mode: 'text', speedy: false },
  { mode: 'insertRule', speedy: true },
] as const

describe.each(RULE_MODES)('createDomSheet, written by $mode', ({ speedy }) => {
  it('creates a style element in the container and inserts rules', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const sheet = createDomSheet('k', container, { speedy })
    sheet.insert('.a{color:red;}')
    expect(container.querySelector('style[data-style="k"]')).not.toBeNull()
    expect(sheet.rules).toEqual(['.a{color:red;}'])
    container.remove()
  })

  it('keeps the rules of two sheets of its way of writing apart from those of the page', () => {
    const first = createDomSheet('k', undefined, { speedy })
    const second = createDomSheet('k', undefined, { speedy })
    first.insert('.a{color:red;}')
    second.insert('.b{color:blue;}')
    // By insertRule they share one element; by text each rule has an element of its own.
    expect(document.querySelectorAll('style[data-style="k"]')).toHaveLength(speedy ? 1 : 2)
    expect(readRuleTexts('k')).toEqual(['.a { color: red; }', '.b { color: blue; }'])
  })

  it('removes a rule from the page, the others staying in order', () => {
    const sheet = createDomSheet('k', undefined, { speedy })
    for (const rule of ['.a{color:red;}', '.b{color:blue;}', '.c{color:green;}']) sheet.insert(rule)
    sheet.remove?.(1)
    expect(sheet.rules).toEqual(['.a{color:red;}', '.c{color:green;}'])
    expect(readRuleTexts('k')).toEqual(['.a { color: red; }', '.c { color: green; }'])
  })

  it('keeps the rules of the other way of writing in an element of their own', () => {
    const own = createDomSheet('k', undefined, { speedy })
    const other = createDomSheet('k', undefined, { speedy: !speedy })
    own.insert('.a{color:red;}')
    other.insert('.b{color:blue;}')
    const elements = document.querySelectorAll<HTMLStyleElement>('style[data-style="k"]')
    expect([...elements].map((element) => element.sheet?.cssRules.length)).toEqual([1, 1])
  })
})

describe('createDomSheet, only when written by text', () => {
  it('holds the live rules as the text of its elements: inserted and removed, and has no replace', () => {
    const sheet = createDomSheet('k', undefined, { speedy: false })
    sheet.insert('@layer k-theme,k-components;')
    sheet.insert('@layer k-theme{.t{--k-a:1px;}}')
    sheet.insert('@layer k-components{.a{color:red;}}')
    expect(readStyleText('k')).toBe(sheet.rules.join(''))
    sheet.remove?.(1)
    sheet.insert('@layer k-theme{.t{--k-a:1px;--k-b:2px;}}')
    expect(sheet.replace).toBeUndefined()
    expect(sheet.rules).toEqual([
      '@layer k-theme,k-components;',
      '@layer k-components{.a{color:red;}}',
      '@layer k-theme{.t{--k-a:1px;--k-b:2px;}}',
    ])
    expect(readStyleText('k')).toBe(sheet.rules.join(''))
    expect(document.querySelectorAll('style[data-style="k"]')).toHaveLength(3)
  })

  it('keeps a rule as it is given: the browser parses the text, and drops what it rejects there', () => {
    const sheet = createDomSheet('k', undefined, { speedy: false })
    sheet.insert('not a rule')
    expect(sheet.rules).toEqual(['not a rule'])
    expect(readStyleText('k')).toBe('not a rule')
  })

  it('writes in an element of its own next to one that a server filled, which it leaves as it is', () => {
    const sent = document.createElement('style')
    sent.dataset.style = 'k'
    sent.textContent = '.s{color:red;}'
    document.head.appendChild(sent)
    const sheet = createDomSheet('k', undefined, { speedy: false })
    sheet.insert('.a{color:blue;}')
    const elements = [...document.querySelectorAll('style[data-style="k"]')]
    expect(elements.map((element) => element.textContent)).toEqual([
      '.s{color:red;}',
      '.a{color:blue;}',
    ])
  })

  it('is the default outside production, and insertRule in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    createDomSheet('p').insert('.a{color:red;}')
    vi.stubEnv('NODE_ENV', 'test')
    createDomSheet('t').insert('.a{color:red;}')
    vi.unstubAllEnvs()
    const readText = (key: string) =>
      document.querySelector(`style[data-style="${key}"]`)?.textContent
    expect([readText('p'), readText('t')]).toEqual(['', '.a{color:red;}'])
  })
})

describe('createDomSheet, only when written by insertRule', () => {
  it('skips a rule the sheet rejects', () => {
    const sheet = createDomSheet('k', undefined, { speedy: true })
    vi.spyOn(CSSStyleSheet.prototype, 'insertRule').mockImplementation(() => {
      throw new SyntaxError('bad rule')
    })
    sheet.insert('not a rule')
    expect(sheet.rules).toEqual([])
  })
})

describe('createCache over a sheet written by text', () => {
  it('passes speedy to the sheet it makes, and does not read its own text as sent by a server', () => {
    const first = createCache({ hasLayers: false, speedy: false })
    const name = first.css({ color: 'red' })
    const second = createCache({ hasLayers: false, speedy: false })
    expect(second.css({ color: 'red' })).toBe(name)
    const elements = [...document.querySelectorAll('style[data-style="css"]')]
    expect(elements.map((element) => element.textContent)).toEqual([
      `.${name}{color:red;}`,
      `.${name}{color:red;}`,
    ])
    createCache({ prefix: 'fast', speedy: true }).css({ color: 'red' })
    expect(document.querySelector('style[data-style="fast"]')?.textContent).toBe('')
  })
})

describe('withStyleOptions', () => {
  it('is the cache itself for its own options, and one view for each other set of options', () => {
    const cache = createCache({ prefix: 'w', sheet: createMemorySheet() })
    expect(cache.withStyleOptions({})).toBe(cache)
    expect(cache.withStyleOptions({ hasColorFallbacks: true, hasValueRepair: false })).toBe(cache)
    const view = cache.withStyleOptions({ hasValueRepair: true })
    expect(cache.withStyleOptions({ hasValueRepair: true, hasColorFallbacks: true })).toBe(view)
    expect(cache.withStyleOptions({ hasColorFallbacks: false })).not.toBe(view)
  })

  it('writes through the view with its options into the same sheet, classes and entries', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'w', sheet, hasLayers: false })
    const view = cache.withStyleOptions({ hasValueRepair: true, hasColorFallbacks: false })
    const repaired = view.css({ color: 'var(--c)20' })
    const plain = cache.css({ color: 'var(--c)20' })
    const entry = view.createEntry({ margin: '-var(--m)' })
    const held = view.cssHeld({}, { padding: '-var(--p)' })
    const fade = view.compileGlobal({ body: { color: 'var(--c)20' } })
    expect(view.cssIn('overrides', { color: 'var(--c)20' })).toBe(repaired)
    expect(view.cssWith({ label: 'Box' }, { color: 'var(--c)20' })).toMatch(/^w-Box-/)
    expect(cache.registered.get(repaired)).toEqual({ color: 'var(--c)20' })
    expect(sheet.rules).toEqual([
      `.${repaired}{color:color-mix(in srgb, var(--c) 12.55%, transparent);}`,
      `.${plain}{color:var(--c)20;}`,
      `.${held.className}{padding:calc(var(--p) * -1);}`,
      expect.stringMatching(/^\.w-Box-\w+\{color:color-mix/),
    ])
    expect(String(entry)).toMatch(/^w-/)
    expect(sheet.rules.at(-1)).toBe(`.${entry.className}{margin:calc(var(--m) * -1);}`)
    expect(fade.rules).toEqual(['body{color:color-mix(in srgb, var(--c) 12.55%, transparent);}'])
    expect(view.adoptEntry(entry)).toBe(entry)
    expect(cache.adoptEntry(entry)).toBe(entry)
  })

  it('writes the animations of a class of the view with its options', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'w', sheet, hasLayers: false })
    const name = keyframes({ to: { opacity: 'var(--o)', color: 'var(--c)20' } }, { label: 'wv' })
    cache.withStyleOptions({ hasValueRepair: true }).css({ animation: `${name} 1s` })
    expect(sheet.rules[0]).toBe(
      `@keyframes ${name}{100%{opacity:var(--o);color:color-mix(in srgb, var(--c) 12.55%, transparent);}}`
    )
  })
})

describe('input that the cache leaves out, with the development checks', () => {
  it('warns once about a value given to css that is not a style, with the label of the class', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'lo', sheet: createMemorySheet(), hasDevChecks: true })
    const fn = () => ({})
    expect(cache.css(5 as never, true as never, fn as never)).toBe('')
    cache.css(5 as never)
    cache.cssWith({ label: 'Box' }, [true as never, { color: 'red' }])
    cache.cssHeld({}, 7 as never)
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[lo] css() was given 5, which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.',
      '[lo] css() was given true, which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.',
      '[lo] css() was given a function, which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.',
      '[lo] css() was given true for "Box", which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.',
      '[lo] css() was given 7, which is not a style: it is left out. Give a style object, a css() value, a class name, or a list of them.',
    ])
    warn.mockRestore()
  })

  it('warns about an @scheme key that names no scheme, at any depth, and not without the checks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'lo', sheet: createMemorySheet(), hasDevChecks: true })
    const name = cache.css({
      '@scheme blue': { color: 'blue' },
      '&:hover': { '@scheme Dark': { color: 'red' }, '@scheme dark': { color: 'red' } },
    })
    createCache({ prefix: 'lo', sheet: createMemorySheet() }).css({
      '@scheme blue': { color: 'blue' },
    })
    expect(warn.mock.calls.map(([message]) => message)).toEqual(
      ['@scheme blue', '@scheme Dark'].map(
        (key) =>
          `[lo] the class ${name} has the key "${key}": a color scheme is light or dark, so it is written as an at-rule that the browser does not know, and drops. Use whenScheme('light') or whenScheme('dark').`
      )
    )
    warn.mockRestore()
  })
})

describe('a rule that the browser rejects', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('is skipped by a sheet written by insertRule, which tells onReject with the message', () => {
    const onReject = vi.fn()
    const sheet = createDomSheet('rj', document.head, { speedy: true, onReject })
    sheet.insert('.a{color:red;}')
    sheet.insert('}{')
    expect(sheet.rules).toEqual(['.a{color:red;}'])
    expect(onReject).toHaveBeenCalledWith('}{', expect.any(String))
  })

  it('is warned about once by a cache with the development checks, with its selector', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'rj', speedy: true, hasDevChecks: true })
    cache.insertOnce('bad', ['@layer rj-components{.a{color:red;}}}{'])
    cache.insertOnce('other', ['}{'])
    const messages = warn.mock.calls.map(([message]) => String(message))
    expect(messages.filter((message) => message.includes('rejected'))).toEqual([
      expect.stringMatching(
        /^\[rj\] the browser rejected the rule of \.a \(.+\): it is left out\.$/
      ),
      expect.stringMatching(
        /^\[rj\] the browser rejected the rule of \}\{ \(.+\): it is left out\.$/
      ),
    ])
    warn.mockRestore()
  })
})

describe('the option hasRuleText, renamed to speedy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  /** The warnings of `run`, in development or in `env`. */
  function readWarnings(run: () => void, env = 'development'): string[] {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', env)
    run()
    vi.unstubAllEnvs()
    return warn.mock.calls.map(([message]) => String(message))
  }

  it('is warned about once for each options object in development, with what to write instead, and is not read', () => {
    // An object of plain JavaScript, or one typed elsewhere: as a literal it is a type error (below).
    const asText = { prefix: 'rn', hasDevChecks: false, hasRuleText: true } as CacheOptions
    const warnings = readWarnings(() => {
      createCache(asText).css({ color: 'red' })
      // The same object again is not warned about again.
      createCache(asText)
      // @ts-expect-error hasRuleText is no option of a DOM sheet: it was renamed to speedy.
      createDomSheet('rd', document.head, { hasRuleText: false }).insert('.a{color:red;}')
    })
    expect(warnings).toEqual([
      '[rn] The option hasRuleText was renamed to speedy, with the opposite meaning: hasRuleText: true is not read, and the default applies. Write speedy: false instead.',
      '[rd] The option hasRuleText was renamed to speedy, with the opposite meaning: hasRuleText: false is not read, and the default applies. Write speedy: true instead.',
    ])
    // Not read: the default of development is text, so the rule is in the text of the element.
    expect(document.querySelector('style[data-style="rd"]')?.textContent).toBe('.a{color:red;}')
  })

  it('is not warned about in production, nor when it is undefined', () => {
    // @ts-expect-error hasRuleText is no option.
    const run = () => createCache({ prefix: 'rp', hasDevChecks: false, hasRuleText: true })
    expect(readWarnings(run, 'production')).toEqual([])
    const runUndefined = () =>
      // @ts-expect-error hasRuleText is no option.
      createDomSheet('ru', document.head, { hasRuleText: undefined })
    expect(readWarnings(runUndefined)).toEqual([])
  })
})
