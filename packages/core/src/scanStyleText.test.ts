import { createEmptyFindings, scanStyleText } from './scanStyleText'

describe('scanStyleText', () => {
  it('finds nothing in an empty text', () => {
    expect(scanStyleText('u', '')).toEqual(createEmptyFindings())
  })

  it('finds the layer order statement, which has no block', () => {
    const found = scanStyleText(
      'u',
      '@layer u-theme,u-global;@layer u-components{.u-a{color:red;}}'
    )
    expect(found.hasLayerOrder).toBe(true)
    expect(scanStyleText('u', '@import "x";.u-a{color:red;}').hasLayerOrder).toBe(false)
  })

  it('reads a class name whole: upper-case letters, non-ASCII letters and escapes', () => {
    const text =
      '@layer u-components{.u-Typography-1p2bgvv{color:red;}.u-\u00dcn\u00ef-a{color:red;}' +
      '.u-a\\.b-c{color:red;}.u-a\\3a b{color:red;}.u-plain-x:hover{color:red;}}'
    expect([...scanStyleText('u', text).classes]).toEqual([
      'u-Typography-1p2bgvv',
      'u-\u00dcn\u00ef-a',
      'u-a.b-c',
      'u-a:b',
      'u-plain-x',
    ])
  })

  it.each([' ', ',', '>', '+', '~', ':', '[', '.'])(
    'ends a class name at the delimiter %j',
    (delimiter) => {
      const found = scanStyleText('u', `.u-Ab_1${delimiter}.u-c{color:red;}`)
      expect(found.classes.has('u-Ab_1')).toBe(true)
    }
  )

  it('finds the classes that rules name, in layers and in at-rules, with their variables', () => {
    const text =
      '@layer u-components{.u-a{color:var(--u-x);}}@layer u-components{.u-a:hover{margin:var( --u-y, 1px);}}' +
      '@media (min-width: 600px){.u-b .u-c{padding:var(--u-z);}}'
    const found = scanStyleText('u', text)
    expect([...found.classes]).toEqual(['u-a', 'u-b', 'u-c'])
    expect([...found.variables]).toEqual(['--u-x', '--u-y', '--u-z'])
  })

  it('leaves out the marker classes and the theme classes that a condition names', () => {
    const text =
      '@scope (.u-theme-abc) to (.u-boundary){.u-a{color:red;}}.u-scheme-light .u-d{color:blue;}' +
      '@scope (.u-scheme-dark) to (.u-scheme-light,.u-scheme-dark){.u-e{color:red;}}'
    const found = scanStyleText('u', text)
    expect([...found.classes]).toEqual(['u-a', 'u-d', 'u-e'])
    expect(found.themes.size).toBe(0)
  })

  it('finds a theme class with the variables it declares, over more than one rule', () => {
    const text =
      '@layer u-theme{.u-theme-1{--u-a:1;--u-b:var(--u-a);color-scheme:light;}}.u-theme-1{--u-c:3}' +
      '.u-theme-2{color-scheme:dark;}'
    const found = scanStyleText('u', text)
    expect(found.themes.get('u-theme-1')).toEqual(new Set(['--u-a', '--u-b', '--u-c']))
    expect(found.themes.get('u-theme-2')).toEqual(new Set())
    expect(found.classes.size).toBe(0)
    expect(found.variables.size).toBe(0)
  })

  it('does not take a rule with more in its selector for a theme rule', () => {
    const found = scanStyleText('u', '.u-theme-1 .u-a{color:red;}.u-theme-2:hover{color:red;}')
    expect(found.themes.size).toBe(0)
    expect([...found.classes]).toEqual(['u-a'])
  })

  it('finds @property rules by variable name, with their text', () => {
    const rule = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#fff;}'
    const found = scanStyleText('u', `${rule}.u-a{color:red;}`)
    expect(found.properties).toEqual(new Map([['--u-a', rule]]))
    expect([...found.classes]).toEqual(['u-a'])
  })

  it('skips other at-rules with a body and rules that name no class of the prefix', () => {
    const text =
      '@font-face{font-family:x;}@keyframes k{from{opacity:0;}to{opacity:1;}}.other{color:red;}'
    expect(scanStyleText('u', text).classes.size).toBe(0)
  })

  it('finds the names of @keyframes rules, empty ones too, and the variables their steps use', () => {
    const text =
      '@keyframes fade-1a{0%{opacity:0;}100%{color:var(--u-x);}}@keyframes  empty-2b {}' +
      '@layer u-components{.u-a{animation:fade-1a 1s;}}'
    const found = scanStyleText('u', text)
    expect(found.keyframes).toEqual(new Set(['fade-1a', 'empty-2b']))
    expect([...found.classes]).toEqual(['u-a'])
    expect([...found.variables]).toEqual(['--u-x'])
  })

  it('is not fooled by braces and semicolons in strings', () => {
    const text = `.u-a::before{content:"}{;";}.u-b::after{content:'it\\'s }';}.u-c{color:red;}`
    expect([...scanStyleText('u', text).classes]).toEqual(['u-a', 'u-b', 'u-c'])
  })

  it('adds to the findings it is given, and survives text that ends inside a block or a string', () => {
    const found = scanStyleText('u', '.u-a{color:red;}')
    scanStyleText('u', '.u-b{color:red;}.u-c{color:red', found)
    scanStyleText('u', '.u-d{content:"never closed', found)
    expect([...found.classes]).toEqual(['u-a', 'u-b'])
  })

  it('counts the top-level rules, and lists those that may be global rules with their places', () => {
    const text =
      '@layer u-theme,u-global;@property --u-a{syntax:"*";inherits:true;}' +
      '@keyframes k{to{opacity:1;}}@layer u-global{body{margin:0;}}' +
      '@layer u-components{.u-a{color:red;}}@layer other{p{color:red;}} ;' +
      '.u-b{color:red;} html, body{color:var(--u-a);}@media (width >= 1px){body{margin:1px;}}'
    const found = scanStyleText('u', text)
    expect(found.ruleCount).toBe(9)
    expect(found.globals).toEqual([
      [3, '@layer u-global{body{margin:0;}}'],
      [7, 'html, body{color:var(--u-a);}'],
      [8, '@media (width >= 1px){body{margin:1px;}}'],
    ])
    expect(found.variables).toEqual(new Set(['--u-a']))
  })

  it('lists the places of the rules of a root theme, in the theme layer or in none, as no global rule', () => {
    const text =
      '@layer u-theme,u-global;@layer u-theme{:where(:root){--u-a:var(--u-b);}}' +
      ':where(:root){--u-a:1;}@layer u-theme{.u-theme-x{--u-a:2;}}:root{color:var(--u-c);}'
    const found = scanStyleText('u', text)
    expect(found.roots).toEqual([1, 2])
    expect(found.globals).toEqual([[4, ':root{color:var(--u-c);}']])
    expect(found.variables).toEqual(new Set(['--u-c']))
  })

  it('lists the top-level rules that name a class of the prefix with their places, in a layer or in none, and no root rule', () => {
    const text =
      '@layer u-theme,u-components;@layer u-theme{:where(:root){--u-a:1;}}' +
      '@layer u-components{.u-a{color:red;}}.u-b:hover{color:red;}@media (width >= 1px){.u-c{margin:0;}}' +
      'body{margin:0;}.x-a{color:red;}'
    const found = scanStyleText('u', text)
    expect(found.classRules).toEqual([
      [2, '@layer u-components{.u-a{color:red;}}'],
      [3, '.u-b:hover{color:red;}'],
      [4, '@media (width >= 1px){.u-c{margin:0;}}'],
    ])
  })

  it('reads a large text in one pass', () => {
    const text = Array.from(
      { length: 20000 },
      (_, index) => `.u-c${index}{color:var(--u-x${index});}`
    ).join('')
    const start = performance.now()
    const found = scanStyleText('u', text)
    expect(found.classes.size).toBe(20000)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
