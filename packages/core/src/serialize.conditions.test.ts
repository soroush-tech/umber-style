import { compileRules } from './serialize'
import { createSchemeKey, createThemeKey } from './scope'

const scoping = { prefix: 'u', hasScope: true }
const fallback = { prefix: 'u', hasScope: false }
const GUARD = ':where(:not(.u-scheme-light,.u-scheme-dark,.u-scheme-light *,.u-scheme-dark *))'

describe('compileRules with a theme condition', () => {
  const style = { border: 'none', [createThemeKey('u-theme-d')]: { border: '1px solid white' } }

  it('writes a scoped rule that stops at the next boundary, after the base rule', () => {
    expect(compileRules('.c', style, true, scoping)).toEqual([
      '.c{border:none;}',
      '@scope (.u-theme-d) to (.u-boundary){.c{border:1px solid white;}}',
    ])
  })

  it('uses the default scoping and prefix when none is given', () => {
    expect(compileRules('.c', style)[1]).toBe(
      '@scope (.u-theme-d) to (.css-boundary){.c{border:1px solid white;}}'
    )
  })

  it('keeps nested selectors and at-rules inside the one scoped rule', () => {
    const nested = {
      [createThemeKey('u-theme-d')]: {
        color: 'red',
        '&:hover': { color: 'blue' },
        '@media (min-width: 10px)': { color: 'green' },
      },
    }
    expect(compileRules('.c', nested, true, scoping)).toEqual([
      '@scope (.u-theme-d) to (.u-boundary){.c{color:red;}.c:hover{color:blue;}@media (min-width: 10px){.c{color:green;}}}',
    ])
  })

  it('works inside a selector and inside an at-rule', () => {
    const inner = { [createThemeKey('u-theme-d')]: { color: 'red' } }
    expect(compileRules('.c', { '&:hover': inner }, true, scoping)).toEqual([
      '@scope (.u-theme-d) to (.u-boundary){.c:hover{color:red;}}',
    ])
    expect(compileRules('.c', { '@media print': inner }, true, scoping)).toEqual([
      '@media print{@scope (.u-theme-d) to (.u-boundary){.c{color:red;}}}',
    ])
  })

  it('writes nothing for an empty condition', () => {
    expect(compileRules('.c', { [createThemeKey('x')]: { color: null } }, true, scoping)).toEqual(
      []
    )
  })

  it('writes the descendant form without hasScope, for every part of a selector list', () => {
    expect(compileRules('.c', style, true, fallback)).toEqual([
      '.c{border:none;}',
      ':where(.u-theme-d) .c{border:1px solid white;}',
    ])
    const list = { '&:hover, &:focus': { [createThemeKey('u-theme-d')]: { color: 'red' } } }
    expect(compileRules('.c', list, true, fallback)).toEqual([
      ':where(.u-theme-d) .c:hover,:where(.u-theme-d) .c:focus{color:red;}',
    ])
  })
})

describe('compileRules with a scheme condition', () => {
  const style = {
    [createSchemeKey('dark')]: { boxShadow: 'none', '&::before': { content: '"x"' } },
  }

  it('writes the scoped rule from the scheme marker to the next one, and the guarded system rule', () => {
    expect(compileRules('.c', style, true, scoping)).toEqual([
      '@scope (.u-scheme-dark) to (.u-scheme-light,.u-scheme-dark){.c{box-shadow:none;}.c::before{content:"x";}}',
      `@media (prefers-color-scheme: dark){.c${GUARD}{box-shadow:none;}.c${GUARD}::before{content:"x";}}`,
    ])
  })

  it('writes the descendant form and the guarded system rule without hasScope', () => {
    expect(
      compileRules('.c', { [createSchemeKey('light')]: { opacity: 0.5 } }, true, fallback)
    ).toEqual([
      ':where(.u-scheme-light) .c{opacity:0.5;}',
      `@media (prefers-color-scheme: light){.c${GUARD}{opacity:0.5;}}`,
    ])
  })

  it('writes nothing for an empty condition', () => {
    expect(compileRules('.c', { [createSchemeKey('dark')]: {} }, true, scoping)).toEqual([])
  })
})
