import { alpha } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { compileGlobalRules, type GlobalStyleObject } from './globalStyles'
import { findAnimationNames, keyframes, type KeyframesSteps } from './keyframes'
import { DEFAULT_SCOPING } from './scope'
import { compileRules, type StyleObject } from './serialize'
import { createSheetEntry } from './sheetEntry'
import { createStandIn } from './standIn'
import { parseKeyframesTemplate, parseStyleTemplate } from './templateStyle'

interface Props {
  theme: { palette: { primary: string } }
  tone?: string
  isOn?: boolean
}

const props: Props = { theme: { palette: { primary: 'var(--palette-primary)' } }, tone: 'loud' }

/** A tag that gives what `parseStyleTemplate` makes. */
const tag = (strings: TemplateStringsArray, ...values: unknown[]) =>
  parseStyleTemplate<Props>(strings, values)

/** A tag for a template without functions: its style. */
const style = (strings: TemplateStringsArray, ...values: unknown[]) =>
  parseStyleTemplate(strings, values) as StyleObject

/** A tag for a template with functions: its style for `props`. */
const styleOf = (strings: TemplateStringsArray, ...values: unknown[]) =>
  (parseStyleTemplate<Props>(strings, values) as (props: Props) => StyleObject)(props)

/** The rules of a style for the class `.x`. */
const rulesOf = (value: StyleObject) => compileRules('.x', value)

/** A tag that gives what `parseKeyframesTemplate` makes. */
const frames = <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) =>
  parseKeyframesTemplate<T>(strings, values)

/** What `parseStyleTemplate` throws for `text`. */
const errorOf = (text: string) => {
  try {
    parseStyleTemplate([text], [])
  } catch (error) {
    return error as TypeError
  }
  throw new Error('no error')
}

/** The compile options of a cache made with the defaults. */
const PLAIN = { hasColorFallbacks: true, hasValueRepair: false, scoping: DEFAULT_SCOPING }

describe('parseStyleTemplate', () => {
  it('reads declarations, with the last ";" optional and whitespace anywhere', () => {
    expect(style`color: red; padding: 8px`).toEqual({ color: 'red', padding: '8px' })
    expect(style`
      color :red ;

      padding:
        8px
        16px
    `).toEqual({ color: 'red', padding: '8px 16px' })
    expect(style`color:red;;padding:0;`).toEqual({ color: 'red', padding: '0' })
  })

  it('gives an empty style for an empty template, or one of whitespace and comments', () => {
    expect(style``).toEqual({})
    expect(style`
    `).toEqual({})
    expect(style`/* nothing */ // here`).toEqual({})
  })

  it('makes camelCase keys that the serializer writes back as they were, vendor prefixes too', () => {
    const parsed = style`
      background-color: blue;
      -webkit-font-smoothing: antialiased;
      -ms-transform: none;
      -moz-appearance: none;
      COLOR: red;
    `
    expect(parsed).toEqual({
      backgroundColor: 'blue',
      WebkitFontSmoothing: 'antialiased',
      MsTransform: 'none',
      MozAppearance: 'none',
      color: 'red',
    })
    expect(rulesOf(parsed)).toEqual([
      '.x{background-color:blue;-webkit-font-smoothing:antialiased;-ms-transform:none;-moz-appearance:none;color:red;}',
    ])
    expect(rulesOf(parsed)).toEqual(
      rulesOf({
        backgroundColor: 'blue',
        WebkitFontSmoothing: 'antialiased',
        msTransform: 'none',
        MozAppearance: 'none',
        color: 'red',
      })
    )
  })

  it('keeps custom properties as written', () => {
    expect(style`--gap: 4px; --Brand-Color: red; --empty: ;`).toEqual({
      '--gap': '4px',
      '--Brand-Color': 'red',
      '--empty': '',
    })
  })

  it('keeps values as text, so a unitless number gets no unit and a unit stays', () => {
    const parsed = style`line-height: 1.5; padding: 8px; margin: 0; z-index: 2; width: ${8}`
    expect(parsed).toEqual({
      lineHeight: '1.5',
      padding: '8px',
      margin: '0',
      zIndex: '2',
      width: '8',
    })
    expect(rulesOf(parsed)).toEqual(['.x{line-height:1.5;padding:8px;margin:0;z-index:2;width:8;}'])
  })

  it('keeps !important, parentheses and commas in a value', () => {
    expect(style`
      color: red !important;
      width: calc((100% - 8px) * 2);
      transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), color 1s;
      gap: var(--gap, 1px);
      grid-template-columns: repeat(2, minmax(0, 1fr))
    `).toEqual({
      color: 'red !important',
      width: 'calc((100% - 8px) * 2)',
      transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), color 1s',
      gap: 'var(--gap, 1px)',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    })
  })

  it('keeps ";", "{", "}" and ":" inside strings and url()', () => {
    expect(style`
      content: "a;b{c}d:e";
      quotes: '"' "'";
      background: url(data:image/svg+xml;utf8,<svg></svg>);
      background-image: url("x;{}.png");
      cursor: url(http://x.test/a.cur), auto;
    `).toEqual({
      content: '"a;b{c}d:e"',
      quotes: `'"' "'"`,
      background: 'url(data:image/svg+xml;utf8,<svg></svg>)',
      backgroundImage: 'url("x;{}.png")',
      cursor: 'url(http://x.test/a.cur), auto',
    })
  })

  it('keeps escapes in strings and selectors', () => {
    expect(style`content: "\\"a\\""; .sm\\:p-2 { padding: 2px }`).toEqual({
      content: '"\\"a\\""',
      '.sm\\:p-2': { padding: '2px' },
    })
  })

  it('reads block comments anywhere and line comments outside parentheses', () => {
    expect(style`
      /* a comment; with { } */
      color: /* inside */ red; // a line comment: with a colon
      background: url(http://x.test/a.png);
      border-image: url(//cdn.test/b.png) 30;
      content: "// not a comment";
      margin: 1px/**/2px
    `).toEqual({
      color: 'red',
      background: 'url(http://x.test/a.png)',
      borderImage: 'url(//cdn.test/b.png) 30',
      content: '"// not a comment"',
      margin: '1px 2px',
    })
  })

  it('skips interpolations in comments, and fills the later ones with the right values', () => {
    expect(style`
      /* ${'skipped'} ${'skipped too'} */
      color: ${'red'};
      // padding: ${'skipped'}
      margin: ${'0'};
      // ${'last'}`).toEqual({ color: 'red', margin: '0' })
  })

  it('reads nested rules, with "&" and without', () => {
    const parsed = style`
      color: red;
      &:hover { opacity: 0.8; }
      :focus { outline: none }
      > p { margin: 0 }
      .a,
      .b { color: blue; }
      & + & { margin-left: 4px }
      &::before { content: "" }
    `
    expect(parsed).toEqual({
      color: 'red',
      '&:hover': { opacity: '0.8' },
      ':focus': { outline: 'none' },
      '> p': { margin: '0' },
      '.a, .b': { color: 'blue' },
      '& + &': { marginLeft: '4px' },
      '&::before': { content: '""' },
    })
    expect(rulesOf(parsed)).toEqual([
      '.x{color:red;}',
      '.x:hover{opacity:0.8;}',
      '.x:focus{outline:none;}',
      '.x > p{margin:0;}',
      '.x .a,.x .b{color:blue;}',
      '.x + .x{margin-left:4px;}',
      '.x::before{content:"";}',
    ])
  })

  it('reads at-rules that hold rules, and rules inside them', () => {
    const parsed = style`
      @media (min-width: 600px) { font-size: 2rem; &:hover { color: red } }
      @supports (display: grid) { display: grid }
      @container card (min-width: 400px) { padding: 16px }
    `
    expect(parsed).toEqual({
      '@media (min-width: 600px)': { fontSize: '2rem', '&:hover': { color: 'red' } },
      '@supports (display: grid)': { display: 'grid' },
      '@container card (min-width: 400px)': { padding: '16px' },
    })
    expect(rulesOf(parsed)).toEqual([
      '@media (min-width: 600px){.x{font-size:2rem;}}',
      '@media (min-width: 600px){.x:hover{color:red;}}',
      '@supports (display: grid){.x{display:grid;}}',
      '@container card (min-width: 400px){.x{padding:16px;}}',
    ])
  })

  it('reads at-rules that hold declarations, for global styles', () => {
    const parsed = style`
      @font-face {
        font-family: Brand;
        src: url(brand.woff2) format("woff2");
        font-display: swap;
      }
      html, body { margin: 0 }
    ` as GlobalStyleObject
    const object: GlobalStyleObject = {
      '@font-face': {
        fontFamily: 'Brand',
        src: 'url(brand.woff2) format("woff2")',
        fontDisplay: 'swap',
      },
      'html, body': { margin: 0 },
    }
    expect(compileGlobalRules(parsed, PLAIN)).toEqual([
      '@font-face{font-family:Brand;src:url(brand.woff2) format("woff2");font-display:swap;}',
      'html,body{margin:0;}',
    ])
    expect(compileGlobalRules(parsed, PLAIN)).toEqual(compileGlobalRules(object, PLAIN))
  })

  it('makes a property declared twice in a block a fallback list, at the place of the last', () => {
    const parsed = style`
      display: block; padding: 0; display: grid; display: flex;
      &:hover { color: red; color: blue }
    `
    expect(parsed).toEqual({
      padding: '0',
      display: ['block', 'grid', 'flex'],
      '&:hover': { color: ['red', 'blue'] },
    })
    expect(rulesOf(parsed)).toEqual([
      '.x{padding:0;display:block;display:grid;display:flex;}',
      '.x:hover{color:red;color:blue;}',
    ])
  })

  it('merges a nested selector written twice, the later declarations winning', () => {
    const parsed = style`
      &:hover { color: red; opacity: 1 }
      color: blue;
      &:hover { opacity: 0.5 }
    `
    expect(parsed).toEqual({ color: 'blue', '&:hover': { color: 'red', opacity: '0.5' } })
    expect(Object.keys(parsed)).toEqual(['color', '&:hover'])
  })

  it('replaces a nested style with a declaration of the same key, and the other way round', () => {
    expect(style`a { color: red } a: 1`).toEqual({ a: '1' })
    expect(style`a: 1; a { color: red }`).toEqual({ a: { color: 'red' } })
  })

  it('splices strings and numbers into values, selectors and property names', () => {
    const parsed = style`
      padding: ${8}px ${'16px'};
      margin-${'top'}: 4px;
      ${'border'}-width: 1px;
      &${':hover'} { color: ${'red'} }
      ${'.a'}, .b { color: blue }
      @media (min-width: ${600}px) { gap: 1px }
      content: "${'x'}";
    `
    expect(parsed).toEqual({
      padding: '8px 16px',
      marginTop: '4px',
      borderWidth: '1px',
      '&:hover': { color: 'red' },
      '.a, .b': { color: 'blue' },
      '@media (min-width: 600px)': { gap: '1px' },
      content: '"x"',
    })
  })

  it('writes nothing for null, undefined, false and true, in a value or between declarations', () => {
    expect(style`
      color: red ${null}${undefined};
      ${false}
      ${true}
      margin: ${false}${true} 0;
      ${null};
      padding: 0
    `).toEqual({ color: 'red', margin: '0', padding: '0' })
  })

  it('splices each item of a list in a value, and merges each item of one between declarations', () => {
    expect(style`
      margin: ${['1px', ' ', 2, 'px']};
      ${[{ color: 'red' }, ['padding: 0', null], { color: 'blue' }]}
    `).toEqual({ margin: '1px 2px', padding: '0', color: 'blue' })
  })

  it('merges a style object between declarations, in order', () => {
    const parsed = style`
      color: red;
      ${{ color: 'blue', '&:hover': { opacity: 0.8 } }}
      padding: 0;
      &:hover { color: green }
    `
    expect(parsed).toEqual({
      color: 'blue',
      padding: '0',
      '&:hover': { opacity: 0.8, color: 'green' },
    })
    expect(Object.keys(parsed)).toEqual(['color', 'padding', '&:hover'])
  })

  it('adds a declaration to a value of a merged object as a fallback, and replaces nothing', () => {
    expect(style`${{ zIndex: 1, color: null, margin: false, order: [1, 2] }}
      z-index: 2; color: red; margin: 0; order: 3`).toEqual({
      zIndex: [1, '2'],
      color: 'red',
      margin: '0',
      order: [1, 2, '3'],
    })
  })

  it('does not change a style object that it merges', () => {
    const hover = { opacity: 0.8 }
    const mixin = { color: 'blue', '&:hover': hover }
    expect(style`${mixin}; color: red; &:hover { color: green }`).toEqual({
      color: ['blue', 'red'],
      '&:hover': { opacity: 0.8, color: 'green' },
    })
    expect(mixin).toEqual({ color: 'blue', '&:hover': { opacity: 0.8 } })
    expect(hover).toEqual({ opacity: 0.8 })
  })

  it('reads CSS text between declarations, with its nested rules', () => {
    expect(style`
      ${'color: red; &:hover { opacity: 0.8 }'}
      color: blue;
    `).toEqual({ '&:hover': { opacity: '0.8' }, color: ['red', 'blue'] })
  })

  it('takes an interpolation alone on its line as a statement of its own', () => {
    const mixin = { color: 'red' }
    expect(style`
      ${mixin}
      padding: 0;
      ${mixin} // a comment
      margin: 0;
      ${mixin}
      ${{ gap: 0 }}
      ${mixin} ${{ order: 1 }};
    `).toEqual({ color: 'red', padding: '0', margin: '0', gap: 0, order: 1 })
  })

  it('keeps an interpolation at the start of a selector or a property name when the line goes on', () => {
    expect(style`
      ${'.a'},
      ${'.b'} { color: red }
      ${'.c'}
      { color: blue }
      ${'margin'}
      : 0;
      ${'&'}
      > p { color: green }
    `).toEqual({
      '.a, .b': { color: 'red' },
      '.c': { color: 'blue' },
      margin: '0',
      '& > p': { color: 'green' },
    })
  })

  it('takes a template of interpolations only', () => {
    expect(style`${{ color: 'red' }}${'padding: 0'}`).toEqual({ color: 'red', padding: '0' })
    expect(style`${{ color: 'red' }} ${{ padding: 0 }}`).toEqual({ color: 'red', padding: 0 })
    expect(style`${'color'}: ${'red'}`).toEqual({ color: 'red' })
  })

  it('keeps an alpha() result that is a whole value, so its fallback is written', () => {
    const color = alpha('#000000', 0.5)
    const parsed = style`color: ${color}; border: 1px solid ${color}`
    expect(parsed.color).toBe(color)
    expect(rulesOf(parsed)).toEqual(rulesOf({ color, border: `1px solid ${color}` }))
    expect(style`color: ${'red'}`).toEqual({ color: 'red' })
  })

  it('splices a stand-in of the theme as its path, and does not call it', () => {
    const theme = createStandIn('') as unknown as Props['theme']
    expect(style`color: ${theme.palette.primary}`).toEqual({ color: 'palette.primary' })
    expect(styleOf`color: ${() => theme.palette.primary}`).toEqual({ color: 'palette.primary' })
  })

  it('splices a keyframes name, which the engine then finds in the rule', () => {
    const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
    const rules = rulesOf(style`animation: ${fade} 200ms ease-out`)
    expect(rules).toEqual([`.x{animation:${fade} 200ms ease-out;}`])
    expect(findAnimationNames(rules)).toEqual([fade])
  })

  it('splices a function with a text of its own, as a component that is a selector', () => {
    const Button = Object.assign(() => null, { toString: () => '.button' })
    expect(style`${Button}:hover & { color: red }`).toEqual({ '.button:hover &': { color: 'red' } })
  })

  it('splices a sheet entry as its class name, and merges its style between declarations', () => {
    const cache = createCache({ hasLayers: false, sheet: createMemorySheet() })
    const entry = cache.createEntry({ color: 'red', '&:hover': { opacity: 0.8 } })
    expect(style`${entry}
      padding: 0;`).toEqual({
      color: 'red',
      '&:hover': { opacity: 0.8 },
      padding: '0',
    })
    expect(style`& .${entry} { color: blue }`).toEqual({
      [`& .${entry.className}`]: { color: 'blue' },
    })
  })

  it('throws for a sheet entry that is only a name, between declarations', () => {
    expect(() => style`${createSheetEntry('css-abc')}`).toThrow(
      new TypeError(
        'parseStyleTemplate(): the sheet entry "css-abc" is only a class name, so its style cannot be merged.'
      )
    )
    expect(style`.${createSheetEntry('css-abc')} { color: red }`).toEqual({
      '.css-abc': { color: 'red' },
    })
  })

  it('throws for a style object in a value, a selector or a property name', () => {
    const error = new TypeError(
      'parseStyleTemplate(): a style object can stand only between declarations, not in a value, a selector or a property name.'
    )
    expect(() => style`color: ${{ color: 'red' }}`).toThrow(error)
    expect(() => style`${{}} > p { color: red }`).toThrow(error)
    expect(() => styleOf`color: ${() => ({})}`).toThrow(error)
  })
})

describe('parseStyleTemplate with functions', () => {
  it('gives a style object, parsed once, when no interpolation is a function', () => {
    expect(typeof tag`color: ${'red'}; ${[{ padding: 0 }]}`).toBe('object')
  })

  it('gives a function of the props when an interpolation, or an item of a list, is a function', () => {
    expect(typeof tag`color: ${({ theme }: Props) => theme.palette.primary}`).toBe('function')
    expect(typeof tag`${[null, [() => 'color: red']]}`).toBe('function')
  })

  it('calls each function with the props on every call', () => {
    const read = vi.fn(({ tone }: Props) => (tone === 'loud' ? '700' : '400'))
    const make = tag`
      color: ${({ theme }: Props) => theme.palette.primary};
      font-weight: ${read};
      &:hover { opacity: ${({ isOn }: Props) => (isOn ? 1 : 0.5)} }
    ` as (props: Props) => StyleObject
    expect(make(props)).toEqual({
      color: 'var(--palette-primary)',
      fontWeight: '700',
      '&:hover': { opacity: '0.5' },
    })
    expect(make({ ...props, tone: 'soft', isOn: true })).toEqual({
      color: 'var(--palette-primary)',
      fontWeight: '400',
      '&:hover': { opacity: '1' },
    })
    expect(read).toHaveBeenCalledTimes(2)
    expect(make(props)).not.toBe(make(props))
  })

  it('reads what a function returns as an interpolation: text, a number, an object, a function, a list', () => {
    expect(styleOf`
      ${({ isOn }: Props) => isOn && 'display: none;'}
      ${({ tone }: Props) => tone === 'loud' && { fontWeight: 700 }}
      width: ${() => 8}px;
      ${() => () => () => ({ color: 'red' })}
      ${() => [{ margin: 0 }, () => 'padding: 1px', null]}
      ${() =>
        () =>
        ({ theme }: Props) =>
          `border-color: ${theme.palette.primary}`}
      margin-${() => () => 'top'}: 1px;
      ${() => '&:hover'} { color: ${() => () => 'blue'} }
    `).toEqual({
      fontWeight: 700,
      width: '8px',
      color: 'red',
      margin: 0,
      padding: '1px',
      borderColor: 'var(--palette-primary)',
      marginTop: '1px',
      '&:hover': { color: 'blue' },
    })
  })

  it('splits the text once for each strings array, and fills it in on every call', () => {
    const strings = ['color: ', '; padding: 0']
    const join = vi.spyOn(strings, 'join')
    expect(parseStyleTemplate(strings, ['red'])).toEqual({ color: 'red', padding: '0' })
    expect(parseStyleTemplate(strings, ['blue'])).toEqual({ color: 'blue', padding: '0' })
    expect(join).toHaveBeenCalledTimes(1)
    expect(parseStyleTemplate(['color: ', '; padding: 0'], ['green'])).toEqual({
      color: 'green',
      padding: '0',
    })
    expect(join).toHaveBeenCalledTimes(1)
  })

  it('gives the same style from one call site with the same values', () => {
    const at = (color: string) => style`color: ${color}; &:hover { opacity: 0.8 }`
    expect(at('red')).toEqual(at('red'))
    expect(at('blue')).toEqual({ color: 'blue', '&:hover': { opacity: '0.8' } })
  })
})

describe('parseStyleTemplate errors', () => {
  it('throws a TypeError with the line and the text around the place', () => {
    expect(errorOf('color: red;\n&:hover { opacity: 1;\n')).toEqual(
      new TypeError(
        'parseStyleTemplate(): an unclosed block at line 2: "color: red; &:hover { opacity:"'
      )
    )
    expect(errorOf('color: red;\npadding 0;')).toEqual(
      new TypeError(
        'parseStyleTemplate(): a declaration without ":" at line 2: "color: red; padding 0;"'
      )
    )
    expect(errorOf('color: red; }')).toEqual(
      new TypeError('parseStyleTemplate(): a "}" without a "{" at line 1: "color: red; }"')
    )
  })

  it('shows an interpolation in the text around the place', () => {
    expect(
      () => style`color: ${'red'};
      padding ${0};`
    ).toThrow(
      new TypeError(
        'parseStyleTemplate(): a declaration without ":" at line 2: "color: ${}; padding ${};"'
      )
    )
  })

  it('throws for each kind of text it cannot read', () => {
    const problems = [
      ['content: "abc', 'an unclosed string'],
      ["content: 'a\\", 'an unclosed string'],
      ['color: red; /* note', 'an unclosed comment'],
      ['width: calc(1px + 2px; }', 'an unclosed "("'],
      ['{ color: red }', 'a block without a selector'],
      [': red', 'a declaration without a property'],
      ['a { b { color: red }', 'an unclosed block'],
      ['color', 'a declaration without ":"'],
    ]
    for (const [text, problem] of problems) {
      expect(errorOf(text as string).message).toContain(
        `parseStyleTemplate(): ${problem} at line 1:`
      )
    }
  })

  it('throws for CSS text between declarations that it cannot read', () => {
    expect(() => style`${'padding 0'}`).toThrow(
      'parseStyleTemplate(): a declaration without ":" at line 1: "padding 0"'
    )
    expect(() => style`${0}`).toThrow('a declaration without ":"')
  })

  it('keeps a backslash before an interpolation, and the interpolation', () => {
    expect(style`content: "\\${'a'}"; .b\\${'c'} { color: red }; width: 1px\\`).toEqual({
      content: '"\\a"',
      '.b\\c': { color: 'red' },
      width: '1px\\',
    })
  })

  it('keeps a ")" without a "(" as text', () => {
    expect(style`width: 1px)`).toEqual({ width: '1px)' })
  })
})

describe('parseStyleTemplate compiles as the equal object style', () => {
  const primary = 'var(--palette-primary)'
  const cases: [string, StyleObject, StyleObject][] = [
    [
      'declarations',
      style`padding: 8px; margin: 0 auto; opacity: 0.5`,
      { padding: 8, margin: '0 auto', opacity: 0.5 },
    ],
    [
      'nesting and at-rules',
      style`
        color: ${primary};
        &:hover { opacity: 0.8; }
        @media (min-width: 600px) { font-size: 2rem; }
      `,
      {
        color: primary,
        '&:hover': { opacity: 0.8 },
        '@media (min-width: 600px)': { fontSize: '2rem' },
      },
    ],
    [
      'selectors',
      style`> li + li { margin-top: 4px } .a, .b { &:focus-visible { outline: 2px solid } }`,
      { '> li + li': { marginTop: 4 }, '.a, .b': { '&:focus-visible': { outline: '2px solid' } } },
    ],
    [
      'fallbacks and custom properties',
      style`--gap: 4px; display: -webkit-box; display: flex; gap: var(--gap)`,
      { '--gap': '4px', display: ['-webkit-box', 'flex'], gap: 'var(--gap)' },
    ],
    [
      'the example of the issue',
      styleOf`
        color: ${({ theme }: Props) => theme.palette.primary};
        padding: ${8}px ${'16px'};
        &:hover { opacity: 0.8; }
        @media (min-width: 600px) { font-size: 2rem; }
        ${{ borderRadius: 4 }}
      `,
      {
        color: primary,
        padding: '8px 16px',
        '&:hover': { opacity: 0.8 },
        '@media (min-width: 600px)': { fontSize: '2rem' },
        borderRadius: 4,
      },
    ],
  ]

  it.each(cases)('%s', (_name, parsed, object) => {
    expect(rulesOf(parsed)).toEqual(rulesOf(object))
  })
})

describe('parseKeyframesTemplate', () => {
  it('reads the steps that keyframes() takes, and names them as the equal object', () => {
    const steps = frames`
      from { opacity: 0; transform: translateY(4px) }
      50% { opacity: 0.5 }
      to { opacity: 1; transform: none }
    `
    const object: KeyframesSteps = {
      from: { opacity: 0, transform: 'translateY(4px)' },
      '50%': { opacity: 0.5 },
      to: { opacity: 1, transform: 'none' },
    }
    expect(steps).toEqual({
      from: { opacity: '0', transform: 'translateY(4px)' },
      '50%': { opacity: '0.5' },
      to: { opacity: '1', transform: 'none' },
    })
    expect(keyframes(steps)).toBe(keyframes(object))
    expect(keyframes(frames`0%, 100% { opacity: 0 } 50% { opacity: 1 }`)).toBe(
      keyframes({ '0%, 100%': { opacity: 0 }, '50%': { opacity: 1 } })
    )
  })

  it('gives a function of the theme when an interpolation is a function, called with { theme }', () => {
    const steps = frames<Props['theme']>`
      from { color: ${({ theme }: Props) => theme.palette.primary} }
      to { color: ${'red'} }
    `
    expect(typeof steps).toBe('function')
    expect((steps as (theme: Props['theme']) => KeyframesSteps)(props.theme)).toEqual({
      from: { color: 'var(--palette-primary)' },
      to: { color: 'red' },
    })
  })
})
