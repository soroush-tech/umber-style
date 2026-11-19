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
