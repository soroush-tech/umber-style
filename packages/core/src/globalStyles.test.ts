import { alpha } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { DEFAULT_SCOPING } from './scope'
import { createSheetEntry } from './sheetEntry'
import {
  compileGlobalRules,
  globalStyles,
  isGlobalStyles,
  readGlobalStyles,
  type GlobalStyleObject,
} from './globalStyles'

interface AppTheme {
  palette: { background: string; text: string }
  breakpoints: { up(name: string): string }
}

const compile = (styles: GlobalStyleObject, hasValueRepair = false) =>
  compileGlobalRules(styles, true, DEFAULT_SCOPING, hasValueRepair)

describe('globalStyles', () => {
  it('returns a frozen handle that writes nothing and needs no engine', () => {
    const handle = globalStyles({ body: { margin: 0 } })
    expect(Object.isFrozen(handle)).toBe(true)
    expect(handle.id).toMatch(/^global-[0-9a-z]+$/)
    expect(isGlobalStyles(handle)).toBe(true)
    expect(handle.resolve(() => ({}) as never)).toEqual({ body: { margin: 0 } })
  })

  it('reads a tagged template as CSS text: selectors and at-rules with their blocks', () => {
    const handle = globalStyles`
      body { margin: 0; }
      @media print { p { color: ${'black'}; } }
    `
    expect(handle.id).toBe(
      globalStyles({ body: { margin: '0' }, '@media print': { p: { color: 'black' } } }).id
    )
    expect(compile(handle.resolve(() => ({}) as never))).toEqual([
      'body{margin:0;}',
      '@media print{p{color:black;}}',
    ])
  })

  it('calls a function of a tagged template with { theme }', () => {
    const handle = globalStyles<AppTheme>`
      body { color: ${({ theme }) => theme.palette.text}; }
    `
    const theme = { palette: { background: 'white', text: 'var(--text)' } } as AppTheme
    expect(handle.resolve(() => theme)).toEqual({ body: { color: 'var(--text)' } })
    expect(handle.id).toMatch(/^global-[0-9a-z]+$/)
  })

  it('checks the properties of a selector and the descriptors of an at-rule by their types', () => {
    const styles: GlobalStyleObject[] = [
      { '@font-face': { fontFamily: 'Inter', src: 'url(/inter.woff2)', fontDisplay: 'swap' } },
      { '@media print': { body: { margin: 0 } } },
      // @ts-expect-error `colr` is not a property
      { body: { colr: 'red' } },
      // @ts-expect-error a selector holds a style, not a value
      { body: 'red' },
    ]
    expect(styles).toHaveLength(4)
  })

  it('gives equal styles an equal id, and other styles another one', () => {
    const base = globalStyles({ body: { margin: 0 }, html: { color: 'red' } })
    expect(globalStyles({ body: { margin: 0 }, html: { color: 'red' } }).id).toBe(base.id)
    expect(globalStyles({ body: { margin: 1 }, html: { color: 'red' } }).id).not.toBe(base.id)
  })

  it('names a function of the theme with a stand-in theme, helpers of the theme included', () => {
    const styles = (theme: AppTheme) => ({
      body: { background: theme.palette.background, color: alpha(theme.palette.text, 0.5) },
      [theme.breakpoints.up('md')]: { body: { fontSize: 18 } },
    })
    const handle = globalStyles(styles)
    expect(globalStyles(styles).id).toBe(handle.id)
    const other = globalStyles((theme: AppTheme) => ({ body: { background: theme.palette.text } }))
    expect(other.id).not.toBe(handle.id)
    // The same text as an object is not the function of the theme.
    expect(globalStyles({ body: { background: 'palette.text' } }).id).not.toBe(other.id)
    const theme = {
      palette: { background: 'var(--u-bg)', text: 'var(--u-text)' },
      breakpoints: { up: (name: string) => `@media (min-width: ${name})` },
    }
    expect(handle.resolve(() => theme)).toEqual(styles(theme))
  })

  it('throws a TypeError for styles that are not an object or a function', () => {
    const message = 'globalStyles(): the styles must be an object, or a function that returns one.'
    for (const value of [null, 'body{}', 4, [{ body: {} }]]) {
      expect(() => globalStyles(value as never)).toThrow(new TypeError(message))
    }
  })
})

describe('readGlobalStyles', () => {
  it('reads a handle, an object and a function, the theme only for a function', () => {
    const readTheme = vi.fn(() => ({ color: 'var(--u-x)' }))
    const object = { body: { margin: 0 } }
    expect(readGlobalStyles(object, readTheme)).toBe(object)
    expect(readGlobalStyles(globalStyles(object), readTheme)).toBe(object)
    expect(readTheme).not.toHaveBeenCalled()
    expect(readGlobalStyles((theme) => ({ body: { color: theme.color } }), readTheme)).toEqual({
      body: { color: 'var(--u-x)' },
    })
  })

  it('tells a handle from an object by its brand', () => {
    expect(isGlobalStyles({ id: 'global-1', resolve: () => ({}) })).toBe(false)
    expect(isGlobalStyles(null)).toBe(false)
    expect(isGlobalStyles(() => ({}))).toBe(false)
  })
})

describe('compileGlobalRules', () => {
  it('writes the selectors of a base as they are given, nesting against them', () => {
    expect(
      compile({
        '*, *::before, *::after': { boxSizing: 'border-box' },
        'html, body': { margin: 0, '&:focus-within': { scrollBehavior: 'smooth' } },
        'p, h1, h2, h3, h4, h5, h6': { overflowWrap: 'break-word' },
        'td, th': { padding: 4 },
        '#root': { isolation: 'isolate' },
        'main [id]': { scrollMarginTop: 64 },
        '::selection': { background: 'yellow' },
      })
    ).toEqual([
      '*, *::before, *::after{box-sizing:border-box;}',
      'html, body{margin:0;}',
      'html:focus-within,body:focus-within{scroll-behavior:smooth;}',
      'p, h1, h2, h3, h4, h5, h6{overflow-wrap:break-word;}',
      'td, th{padding:4px;}',
      '#root{isolation:isolate;}',
      'main [id]{scroll-margin-top:64px;}',
      '::selection{background:yellow;}',
    ])
  })

  it('writes vendor-prefixed properties and the properties of a text base', () => {
    expect(
      compile({
        html: {
          WebkitTextSizeAdjust: '100%',
          MozOsxFontSmoothing: 'grayscale',
          WebkitFontSmoothing: 'antialiased',
          tabSize: 4,
          fontSynthesis: 'none',
          textRendering: 'optimizeLegibility',
        },
      })
    ).toEqual([
      'html{-webkit-text-size-adjust:100%;-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;tab-size:4;font-synthesis:none;text-rendering:optimizeLegibility;}',
    ])
  })

  it('writes an at-rule that holds selectors as one rule around them, and leaves out an empty one', () => {
    expect(
      compile({
        '@media (width >= 600px)': { body: { fontSize: 18 }, 'h1, h2': { margin: 0 } },
        '@supports (display: grid)': { '@media print': { main: { display: 'grid' } } },
        '@media screen': { body: null },
      })
    ).toEqual([
      '@media (width >= 600px){body{font-size:18px;}h1, h2{margin:0;}}',
      '@supports (display: grid){@media print{main{display:grid;}}}',
    ])
  })

  it('writes an at-rule that takes declarations once for each item of a list, or for one object', () => {
    expect(
      compile({
        '@font-face': [
          { fontFamily: 'Inter', fontWeight: 400, src: 'url(/inter-400.woff2)' },
          { fontFamily: 'Inter', fontWeight: 700, src: 'url(/inter-700.woff2)' },
        ],
        '@page': { margin: '1cm' },
      })
    ).toEqual([
      '@font-face{font-family:Inter;font-weight:400;src:url(/inter-400.woff2);}',
      '@font-face{font-family:Inter;font-weight:700;src:url(/inter-700.woff2);}',
      '@page{margin:1cm;}',
    ])
  })

  it('skips a key with no style, and writes an alpha() color with its fallback', () => {
    expect(compile({ body: false, html: undefined, p: { color: alpha('#ff0000', 0.5) } })).toEqual([
      'p{color:rgba(255, 0, 0, 0.5);color:color-mix(in srgb, #ff0000 50%, transparent);}',
    ])
  })

  it('rewrites the string forms of token maths with hasValueRepair, at any depth', () => {
    const styles = { p: { margin: '-var(--x)' }, '@media print': { p: { color: 'var(--x)ff' } } }
    expect(compile(styles, true)).toEqual([
      'p{margin:calc(var(--x) * -1);}',
      '@media print{p{color:var(--x);}}',
    ])
    expect(compile(styles)).toEqual(['p{margin:-var(--x);}', '@media print{p{color:var(--x)ff;}}'])
  })

  it('writes the style of a sheet entry under a selector, at any depth of at-rules', () => {
    const cache = createCache({ prefix: 'g', sheet: createMemorySheet() })
    const entry = cache.createEntry({ margin: 0, '&:hover': { color: 'red' } })
    expect(compile({ body: entry, '@media print': { p: [entry] } })).toEqual([
      'body{margin:0;}',
      'body:hover{color:red;}',
      '@media print{p{margin:0;}p:hover{color:red;}}',
    ])
  })

  it('throws a TypeError for a sheet entry that is only a class name', () => {
    expect(() => compile({ body: createSheetEntry('foreign') })).toThrow(
      new TypeError(
        'globalStyles(): the sheet entry "foreign" is only a class name, so its style cannot be merged.'
      )
    )
  })

  it('throws a TypeError for styles that are not an object, and for a key that holds no style', () => {
    for (const styles of ['body', null, [{ body: {} }]]) {
      expect(() => compile(styles as never)).toThrow(
        new TypeError(
          'globalStyles(): the styles must be an object, or a function that returns one.'
        )
      )
    }
    for (const value of ['red', [{ margin: 0 }, 'x'], [[{ margin: 0 }]]]) {
      expect(() => compile({ body: value as never })).toThrow(
        new TypeError('globalStyles(): "body" must hold a style object, or a list of them.')
      )
    }
  })
})
