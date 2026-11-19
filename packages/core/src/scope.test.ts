import {
  createNoSchemeGuard,
  createSchemeKey,
  createScopeRule,
  createThemeClassName,
  createThemeKey,
  getBoundaryClass,
  getSchemeClass,
  readCondition,
} from './scope'

describe('the condition keys', () => {
  it('writes a theme key and a scheme key that read back', () => {
    expect(createThemeKey('u-theme-abc')).toBe('@theme u-theme-abc')
    expect(createSchemeKey('dark')).toBe('@scheme dark')
    expect(readCondition('@theme u-theme-abc')).toEqual({ kind: 'theme', id: 'u-theme-abc' })
    expect(readCondition('@scheme light')).toEqual({ kind: 'scheme', scheme: 'light' })
  })

  it('reads no condition from any other key, or from a scheme that is not one', () => {
    for (const key of ['@media (x)', '@scheme', '@scheme blue', '@themes x', ':hover', 'color']) {
      expect(readCondition(key)).toBeUndefined()
    }
  })
})

describe('the marker classes', () => {
  it('names the boundary and the scheme markers after the prefix', () => {
    expect(getBoundaryClass('u')).toBe('u-boundary')
    expect(getSchemeClass('u', 'dark')).toBe('u-scheme-dark')
  })

  it('gives a theme its boundary, and a scheme marker only for light or dark', () => {
    expect(createThemeClassName('u', 'u-theme-a')).toBe('u-theme-a u-boundary')
    expect(createThemeClassName('u', 'u-theme-a', 'light dark')).toBe('u-theme-a u-boundary')
    expect(createThemeClassName('u', 'u-theme-a', 'dark')).toBe(
      'u-theme-a u-boundary u-scheme-dark'
    )
    expect(createThemeClassName('u', 'u-theme-a', 'light')).toBe(
      'u-theme-a u-boundary u-scheme-light'
    )
  })
})

describe('the scope rule and the guard', () => {
  it('writes @scope with a start and a limit', () => {
    expect(createScopeRule('.a', '.b', ['.c{x:y;}', '.d{x:z;}'])).toBe(
      '@scope (.a) to (.b){.c{x:y;}.d{x:z;}}'
    )
  })

  it('matches an element with no scheme marker on it or above it', () => {
    expect(createNoSchemeGuard('u')).toBe(
      ':where(:not(.u-scheme-light,.u-scheme-dark,.u-scheme-light *,.u-scheme-dark *))'
    )
  })
})
