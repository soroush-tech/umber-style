import { findBrowserSupports, findUnsupportedDeclarations } from './findUnsupportedDeclarations'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A browser that knows these properties, and takes any value for them that does not start with `no`. */
const KNOWN = new Set(['color', 'display', 'margin', 'background', 'content', 'opacity'])
function fakeSupports(property: string, value: string): boolean {
  return KNOWN.has(property) && !value.startsWith('no')
}

function find(...texts: string[]) {
  return findUnsupportedDeclarations(texts, 'u', fakeSupports)
}

describe('findUnsupportedDeclarations', () => {
  it('finds nothing in rules the browser supports', () => {
    expect(
      find('.u-a{color:red;margin:0 4px}', '@layer u-components{.u-b{display:flex;}}')
    ).toEqual([])
  })

  it('names the class, the property and the value of a declaration the browser rejects', () => {
    expect(find('@layer u-components{.u-a{color:red;elevation:2px;display:nope}}')).toEqual([
      'the class u-a declares elevation:2px, which this browser does not support',
      'the class u-a declares display:nope, which this browser does not support',
    ])
  })

  it('names the last class of the engine in the selector, the selector of a global rule, and a keyframes rule', () => {
    expect(
      find(
        ':where(.u-theme-1) .u-b:hover{elevation:1px}',
        '@layer u-global{body, .other{elevation:2px}}',
        '@keyframes u-spin{from{opacity:0}to{elevation:3px}}'
      )
    ).toEqual([
      'the class u-b declares elevation:1px, which this browser does not support',
      'the global rule body, .other declares elevation:2px, which this browser does not support',
      'the keyframes u-spin declares elevation:3px, which this browser does not support',
    ])
  })

  it('leaves out a property with a vendor prefix, and a custom property', () => {
    expect(
      find('.u-a{-webkit-line-clamp:2;-moz-osx-font-smoothing:grayscale;-ms-x:1;-o-x:1;--u-x:nope}')
    ).toEqual([])
  })

  it('leaves out a value with a vendor prefix: a keyword, a function, and one with !important', () => {
    expect(
      find(
        '.u-a{display:-webkit-box;margin:-moz-available;background:-webkit-linear-gradient(top, red, blue);opacity:-ms-x !important;color:-o-x}'
      )
    ).toEqual([])
    expect(find('.u-a{display:nope-webkit-box}')).toEqual([
      'the class u-a declares display:nope-webkit-box, which this browser does not support',
    ])
  })

  it('asks only about the last declaration of a property: the earlier items of a fallback list are meant to be dropped', () => {
    expect(find('.u-a{display:nope;display:flex}')).toEqual([])
    expect(find('.u-a{display:flex;display:nope}')).toEqual([
      'the class u-a declares display:nope, which this browser does not support',
    ])
  })

  it('asks whether the browser knows the property of a value with a variable', () => {
    const supports = vi.fn(fakeSupports)
    const found = findUnsupportedDeclarations(
      ['.u-a{color:var(--u-x);elevation:var(--u-y, 2px)}'],
      'u',
      supports
    )
    expect(supports.mock.calls).toEqual([
      ['color', 'inherit'],
      ['elevation', 'inherit'],
    ])
    expect(found).toEqual([
      'the class u-a declares elevation:var(--u-y, 2px), which this browser does not support',
    ])
  })

  it('leaves !important out of the question, and keeps it in the message', () => {
    expect(find('.u-a{color:red !important;display:nope!important}')).toEqual([
      'the class u-a declares display:nope!important, which this browser does not support',
    ])
  })

  it('reads values with semicolons in strings and brackets, and skips at-rules with descriptors', () => {
    expect(
      find(
        '@property --u-x{syntax:"<color>";inherits:true;initial-value:red}',
        '@font-face{font-family:x;src:url(a.woff)}',
        '.u-a[data-x="}{;"]{content:"a;}";background:url(data:image/png;base64,AA==);elevation:"x\\"y"}'
      )
    ).toEqual(['the class u-a declares elevation:"x\\"y", which this browser does not support'])
  })

  it('survives text that is not well formed', () => {
    expect(find('}.u-a{color:red;;nothing}', '@layer a,b;.u-b{elevation:1px')).toEqual([])
  })
})

describe('findBrowserSupports', () => {
  function stubBrowser(userAgent: string, supports: (property: string, value: string) => boolean) {
    vi.stubGlobal('navigator', { userAgent })
    vi.stubGlobal('CSS', { supports })
  }

  it('is CSS.supports of a browser that answers plain questions right', () => {
    stubBrowser('Chrome', fakeSupports)
    const supports = findBrowserSupports()
    expect(supports?.('color', 'red')).toBe(true)
    expect(supports?.('elevation', '2px')).toBe(false)
  })

  it('is undefined in jsdom, whose answers are not those of a browser', () => {
    expect(findBrowserSupports()).toBeUndefined()
  })

  it('is undefined where CSS.supports answers wrong, throws, or is missing', () => {
    stubBrowser('Chrome', () => false)
    expect(findBrowserSupports()).toBeUndefined()
    stubBrowser('Chrome', () => true)
    expect(findBrowserSupports()).toBeUndefined()
    stubBrowser('Chrome', () => {
      throw new Error('no')
    })
    expect(findBrowserSupports()).toBeUndefined()
    vi.stubGlobal('CSS', undefined)
    expect(findBrowserSupports()).toBeUndefined()
  })
})
