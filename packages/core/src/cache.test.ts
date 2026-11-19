import { createCache, createDomSheet, createMemorySheet } from './cache'

afterEach(() => {
  document.head.innerHTML = ''
  vi.restoreAllMocks()
})

describe('createCache', () => {
  it('inserts the same style once', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ sheet })
    const first = cache.css({ color: 'red' })
    const second = cache.css({ color: 'red' })
    expect(second).toBe(first)
    expect(sheet.rules).toEqual([`.${first}{color:red;}`])
  })

  it('makes one new class from several cache classes, the last winning', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ sheet })
    const a = cache.css({ color: 'red', margin: 1 })
    const b = cache.css({ color: 'blue' })
    const merged = cache.css(a, b)
    expect(merged.split(' ')).toHaveLength(1)
    expect(merged).not.toBe(a)
    expect(merged).not.toBe(b)
    expect(sheet.rules.at(-1)).toBe(`.${merged}{margin:1px;color:blue;}`)
  })

  it('returns the same class for a single cache class', () => {
    const cache = createCache({ sheet: createMemorySheet() })
    const a = cache.css({ color: 'red' })
    expect(cache.css(a)).toBe(a)
  })

  it('passes other class names through in front of the new class', () => {
    const cache = createCache({ sheet: createMemorySheet() })
    const result = cache.css('  plain other ', { color: 'red' }, null, undefined, false)
    const [plain, other, made] = result.split(' ')
    expect([plain, other]).toEqual(['plain', 'other'])
    expect(cache.registered.has(made)).toBe(true)
  })

  it('returns only the raw classes, or an empty string, when there is no style', () => {
    const cache = createCache({ sheet: createMemorySheet() })
    expect(cache.css('a  b')).toBe('a b')
    expect(cache.css()).toBe('')
    expect(cache.css('', null)).toBe('')
  })

  it('names a class with prefix, label, hash and suffix', () => {
    const cache = createCache({ prefix: 'ds', suffix: '-x', sheet: createMemorySheet() })
    expect(cache.css({ label: 'button-root', color: 'red' })).toMatch(
      /^ds-button-root-[a-z0-9]+-x$/
    )
  })

  it('drops the label when hasLabels is false', () => {
    const cache = createCache({ prefix: 'ds', hasLabels: false, sheet: createMemorySheet() })
    expect(cache.css({ label: 'button-root', color: 'red' })).toMatch(/^ds-[a-z0-9]+$/)
  })

  it('omits the label part when a style has none', () => {
    const cache = createCache({ sheet: createMemorySheet() })
    expect(cache.css({ color: 'red' })).toMatch(/^css-[a-z0-9]+$/)
  })

  it('throws for an invalid prefix', () => {
    expect(() => createCache({ prefix: 'Bad Prefix' })).toThrow(/Invalid cache prefix/)
    expect(() => createCache({ prefix: '1a' })).toThrow()
  })

  it('inserts once under an id and says whether it did', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ sheet })
    expect(cache.insertOnce('x', ['a{}', 'b{}'])).toBe(true)
    expect(cache.insertOnce('x', ['c{}'])).toBe(false)
    expect(sheet.rules).toEqual(['a{}', 'b{}'])
  })

  it('extracts the css and the ids', () => {
    const cache = createCache({ sheet: createMemorySheet() })
    const name = cache.css({ color: 'red' })
    cache.insertOnce('other', ['p{x:y;}'])
    expect(cache.extract()).toEqual({ css: `.${name}{color:red;}p{x:y;}`, ids: [name, 'other'] })
  })

  it('treats ids from a server-rendered style element as inserted', () => {
    const element = document.createElement('style')
    element.setAttribute('data-style', 'css')
    element.setAttribute('data-ids', 'one  two')
    document.head.appendChild(element)
    const sheet = createMemorySheet()
    const cache = createCache({ sheet })
    expect(cache.insertOnce('one', ['a{}'])).toBe(false)
    expect(cache.insertOnce('three', ['b{}'])).toBe(true)
    expect(cache.extract().ids).toEqual(['one', 'two', 'three'])
  })

  it('uses a DOM sheet by default where there is a document', () => {
    const cache = createCache()
    const name = cache.css({ color: 'red' })
    const element = document.querySelector<HTMLStyleElement>('style[data-style="css"]')
    expect(element?.sheet?.cssRules).toHaveLength(1)
    expect(cache.extract().css).toBe(`.${name}{color:red;}`)
  })
})

describe('createDomSheet', () => {
  it('creates a style element in the container and inserts rules', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const sheet = createDomSheet('k', container)
    sheet.insert('.a{color:red;}')
    expect(container.querySelector('style[data-style="k"]')).not.toBeNull()
    expect(sheet.rules).toEqual(['.a{color:red;}'])
    container.remove()
  })

  it('reuses an existing element', () => {
    const first = createDomSheet('k')
    const second = createDomSheet('k')
    first.insert('.a{color:red;}')
    second.insert('.b{color:blue;}')
    expect(document.querySelectorAll('style[data-style="k"]')).toHaveLength(1)
    const element = document.querySelector<HTMLStyleElement>('style[data-style="k"]')
    expect(element?.sheet?.cssRules).toHaveLength(2)
  })

  it('skips a rule the sheet rejects', () => {
    const sheet = createDomSheet('k')
    vi.spyOn(CSSStyleSheet.prototype, 'insertRule').mockImplementation(() => {
      throw new SyntaxError('bad rule')
    })
    sheet.insert('not a rule')
    expect(sheet.rules).toEqual([])
  })
})
