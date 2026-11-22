import { createCache, createDomSheet, createMemorySheet } from './cache'

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

const RULE_MODES = [
  { mode: 'text', hasRuleText: true },
  { mode: 'insertRule', hasRuleText: false },
] as const

describe.each(RULE_MODES)('createDomSheet, written by $mode', ({ hasRuleText }) => {
  it('creates a style element in the container and inserts rules', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const sheet = createDomSheet('k', container, { hasRuleText })
    sheet.insert('.a{color:red;}')
    expect(container.querySelector('style[data-style="k"]')).not.toBeNull()
    expect(sheet.rules).toEqual(['.a{color:red;}'])
    container.remove()
  })

  it('reuses an existing element of its own way of writing', () => {
    const first = createDomSheet('k', undefined, { hasRuleText })
    const second = createDomSheet('k', undefined, { hasRuleText })
    first.insert('.a{color:red;}')
    second.insert('.b{color:blue;}')
    expect(document.querySelectorAll('style[data-style="k"]')).toHaveLength(1)
    const element = document.querySelector<HTMLStyleElement>('style[data-style="k"]')
    expect(element?.sheet?.cssRules).toHaveLength(2)
  })

  it('removes a rule from the element, the others staying in order', () => {
    const sheet = createDomSheet('k', undefined, { hasRuleText })
    for (const rule of ['.a{color:red;}', '.b{color:blue;}', '.c{color:green;}']) sheet.insert(rule)
    sheet.remove?.(1)
    expect(sheet.rules).toEqual(['.a{color:red;}', '.c{color:green;}'])
    const element = document.querySelector<HTMLStyleElement>('style[data-style="k"]')
    const texts = [...(element?.sheet?.cssRules ?? [])].map((rule) => rule.cssText)
    expect(texts).toEqual(['.a { color: red; }', '.c { color: green; }'])
  })

  it('keeps the rules of the other way of writing in an element of their own', () => {
    const own = createDomSheet('k', undefined, { hasRuleText })
    const other = createDomSheet('k', undefined, { hasRuleText: !hasRuleText })
    own.insert('.a{color:red;}')
    other.insert('.b{color:blue;}')
    const elements = document.querySelectorAll<HTMLStyleElement>('style[data-style="k"]')
    expect([...elements].map((element) => element.sheet?.cssRules.length)).toEqual([1, 1])
  })
})

describe('createDomSheet, only when written by text', () => {
  const readElement = () => document.querySelector<HTMLStyleElement>('style[data-style="k"]')

  it('holds the live rules as the text of its element: inserted and removed, and has no replace', () => {
    const sheet = createDomSheet('k', undefined, { hasRuleText: true })
    sheet.insert('@layer k-theme,k-components;')
    sheet.insert('@layer k-theme{.t{--k-a:1px;}}')
    sheet.insert('@layer k-components{.a{color:red;}}')
    expect(readElement()?.textContent).toBe(sheet.rules.join(''))
    sheet.remove?.(1)
    sheet.insert('@layer k-theme{.t{--k-a:1px;--k-b:2px;}}')
    expect(sheet.replace).toBeUndefined()
    expect(sheet.rules).toEqual([
      '@layer k-theme,k-components;',
      '@layer k-components{.a{color:red;}}',
      '@layer k-theme{.t{--k-a:1px;--k-b:2px;}}',
    ])
    expect(readElement()?.textContent).toBe(sheet.rules.join(''))
  })

  it('keeps a rule as it is given: the browser parses the text, and drops what it rejects there', () => {
    const sheet = createDomSheet('k', undefined, { hasRuleText: true })
    sheet.insert('not a rule')
    expect(sheet.rules).toEqual(['not a rule'])
    expect(readElement()?.textContent).toBe('not a rule')
  })

  it('writes in an element of its own next to one that a server filled, which it leaves as it is', () => {
    const sent = document.createElement('style')
    sent.dataset.style = 'k'
    sent.textContent = '.s{color:red;}'
    document.head.appendChild(sent)
    const sheet = createDomSheet('k', undefined, { hasRuleText: true })
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
    const sheet = createDomSheet('k', undefined, { hasRuleText: false })
    vi.spyOn(CSSStyleSheet.prototype, 'insertRule').mockImplementation(() => {
      throw new SyntaxError('bad rule')
    })
    sheet.insert('not a rule')
    expect(sheet.rules).toEqual([])
  })
})

describe('createCache over a sheet written by text', () => {
  it('passes hasRuleText to the sheet it makes, and does not read its own text as sent by a server', () => {
    const first = createCache({ hasLayers: false, hasRuleText: true })
    const name = first.css({ color: 'red' })
    const second = createCache({ hasLayers: false, hasRuleText: true })
    expect(second.css({ color: 'red' })).toBe(name)
    const element = document.querySelector('style[data-style="css"]')
    expect(element?.textContent).toBe(`.${name}{color:red;}.${name}{color:red;}`)
    createCache({ prefix: 'fast', hasRuleText: false }).css({ color: 'red' })
    expect(document.querySelector('style[data-style="fast"]')?.textContent).toBe('')
  })
})
