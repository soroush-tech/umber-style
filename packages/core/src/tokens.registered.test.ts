import { createTokens, type TokenOptions } from './tokens'

const theme = {
  palette: { primary: '#0b57d0', faint: 'rgba(0, 0, 0, 0.5)', mode: 'dark' },
  space: [0, 4, 8],
  sizes: { icon: '24px', wide: '50%' },
  zIndex: { modal: 100 },
  opacity: { disabled: 0.4 },
  transitions: { duration: { short: '150ms', long: '1s' }, easing: 'ease' },
  angles: { tilt: '45deg' },
  breakpoints: { md: '600px' },
}

/** The registrations of `theme` with these options. */
function register(registered: TokenOptions['registered'], options: TokenOptions = {}) {
  return createTokens(theme, { prefix: 'u', registered, ...options }).registrations
}

describe('a token that is registered with true', () => {
  it('is a color for a hex literal, rgba(), hsl() and transparent', () => {
    const rules = register({ 'palette.primary': true, 'palette.faint': true })
    expect(rules['--u-palette-primary']).toBe(
      '@property --u-palette-primary{syntax:"<color>";inherits:true;initial-value:#0b57d0;}'
    )
    expect(rules['--u-palette-faint']).toBe(
      '@property --u-palette-faint{syntax:"<color>";inherits:true;initial-value:rgba(0, 0, 0, 0.5);}'
    )
    const others = createTokens(
      {
        a: '#fff',
        b: '#ffff',
        c: 'hsl(10 20% 30%)',
        d: 'hsla(10, 20%, 30%, 0.5)',
        e: 'transparent',
      },
      { registered: { a: true, b: true, c: true, d: true, e: true } }
    ).registrations
    expect(Object.keys(others)).toHaveLength(5)
    expect(Object.values(others).every((rule) => rule.includes('syntax:"<color>"'))).toBe(true)
  })

  it('is a length for a number under a length key, written in px, and for a string with a unit', () => {
    const rules = register({ space: true, sizes: true, 'sizes.wide': '*' })
    expect(rules['--u-space-1']).toBe(
      '@property --u-space-1{syntax:"<length>";inherits:true;initial-value:4px;}'
    )
    expect(rules['--u-space-0']).toBe(
      '@property --u-space-0{syntax:"<length>";inherits:true;initial-value:0;}'
    )
    expect(rules['--u-sizes-icon']).toContain('syntax:"<length>";inherits:true;initial-value:24px;')
  })

  it('is a number for a plain number elsewhere, and for a string that is one', () => {
    const rules = register({ zIndex: true, opacity: true })
    expect(rules['--u-z-index-modal']).toBe(
      '@property --u-z-index-modal{syntax:"<number>";inherits:true;initial-value:100;}'
    )
    expect(rules['--u-opacity-disabled']).toContain('syntax:"<number>"')
    const text = createTokens({ weight: '600' }, { registered: { weight: true } }).registrations
    expect(text['--weight']).toContain('syntax:"<number>";inherits:true;initial-value:600;')
  })

  it('is a percentage, a time and an angle for a string with that unit', () => {
    const rules = register({ 'sizes.wide': true, 'transitions.duration': true, angles: true })
    expect(rules['--u-sizes-wide']).toContain('syntax:"<percentage>"')
    expect(rules['--u-transitions-duration-short']).toContain(
      'syntax:"<time>";inherits:true;initial-value:150ms;'
    )
    expect(rules['--u-transitions-duration-long']).toContain('syntax:"<time>"')
    expect(rules['--u-angles-tilt']).toContain('syntax:"<angle>"')
  })

  it('throws a TypeError that names the path when the syntax cannot be inferred', () => {
    expect(() => register({ 'palette.mode': true })).toThrow(TypeError)
    expect(() => register({ 'palette.mode': true })).toThrow(
      /"palette\.mode".*cannot be inferred.*"dark".*explicit syntax/
    )
    expect(() => register({ transitions: true })).toThrow(/"transitions\.easing"/)
  })
})

describe('a token that is registered with a syntax', () => {
  it('writes that syntax and the base value', () => {
    const rules = register({
      'palette.primary': '<color>',
      'space.1': '<length-percentage>',
      'sizes.wide': '<length-percentage>',
      'sizes.icon': '<length-percentage>',
      'zIndex.modal': '<number>',
      'opacity.disabled': '<number>',
    })
    expect(rules['--u-palette-primary']).toContain('syntax:"<color>"')
    expect(rules['--u-space-1']).toContain(
      'syntax:"<length-percentage>";inherits:true;initial-value:4px;'
    )
    expect(rules['--u-sizes-wide']).toContain('initial-value:50%;')
    expect(rules['--u-sizes-icon']).toContain('initial-value:24px;')
    expect(rules['--u-opacity-disabled']).toContain('initial-value:0.4;')
  })

  it('accepts a keyword as a color, and a math function for a number, a length and an angle', () => {
    const rules = createTokens(
      { c: 'red', l: 'calc(8px * 2)', n: 'clamp(1, 2, 3)', a: 'min(10deg, 20deg)' },
      { registered: { c: '<color>', l: '<length>', n: '<number>', a: '<angle>' } }
    ).registrations
    expect(rules['--c']).toContain('initial-value:red;')
    expect(rules['--l']).toContain('initial-value:calc(8px * 2);')
    expect(Object.keys(rules)).toHaveLength(4)
  })

  it('writes * with no initial value, for any value', () => {
    const rules = register({ 'palette.mode': '*', 'transitions.easing': '*' })
    expect(rules['--u-palette-mode']).toBe('@property --u-palette-mode{syntax:"*";inherits:true;}')
    expect(rules['--u-transitions-easing']).toBe(
      '@property --u-transitions-easing{syntax:"*";inherits:true;}'
    )
  })

  it('always sets inherits to true, so that a nested theme reaches what is inside it', () => {
    const rules = Object.values(register({ 'palette.primary': '<color>', 'palette.mode': '*' }))
    expect(rules).toHaveLength(2)
    for (const rule of rules) {
      expect(rule).toContain('inherits:true;')
      expect(rule).not.toContain('inherits:false')
    }
  })

  it('throws a TypeError for a syntax it does not know', () => {
    expect(() => register({ 'palette.primary': '<image>' as '<color>' })).toThrow(TypeError)
    expect(() => register({ 'palette.primary': '<image>' as '<color>' })).toThrow(
      /"palette\.primary".*<image>/
    )
  })

  it('throws a TypeError for a value that is not of the syntax', () => {
    expect(() => register({ 'palette.primary': '<length>' })).toThrow(
      /"palette\.primary".*"#0b57d0".*not a <length>/
    )
    expect(() => register({ 'space.1': '<color>' })).toThrow(TypeError)
    expect(() => register({ 'space.1': '<number>' })).toThrow(TypeError)
    expect(() => register({ 'sizes.icon': '<percentage>' })).toThrow(TypeError)
    expect(() => register({ 'sizes.wide': '<length>' })).toThrow(TypeError)
    expect(() => register({ 'sizes.icon': '<angle>' })).toThrow(TypeError)
    expect(() => register({ 'sizes.icon': '<time>' })).toThrow(TypeError)
    expect(() => register({ 'angles.tilt': '<color>' })).toThrow(TypeError)
  })

  it('throws a TypeError for a value that cannot be an initial value, and not for *', () => {
    for (const value of [
      'var(--other)',
      '2em',
      '1.5rem',
      '10vw',
      '5dvh',
      'calc(1px + 2em)',
      'currentcolor',
      'env(safe-area-inset-top)',
    ]) {
      const fixture = { x: value }
      expect(() => createTokens(fixture, { registered: { x: '<length>' } })).toThrow(
        /"x".*cannot be the initial value/
      )
      expect(() => createTokens(fixture, { registered: { x: '*' } })).not.toThrow()
    }
    expect(() => createTokens({ x: 'var(--a)' }, { registered: { x: true } })).toThrow(TypeError)
    expect(() => createTokens({ x: '2em' }, { registered: { x: true } })).toThrow(/"x"/)
  })

  it('does not take an absolute unit, a hex color or a number with an exponent for a relative unit', () => {
    const rules = createTokens(
      { a: '10px', b: '#1ec0ec', c: '1e3', d: '2in' },
      { registered: { a: true, b: true, c: true, d: true } }
    ).registrations
    expect(Object.keys(rules)).toHaveLength(4)
  })
})

describe('which tokens are registered', () => {
  it('uses the most specific path, a top-level key covering everything under it', () => {
    const rules = register({ palette: '<color>', 'palette.mode': '*' })
    expect(Object.keys(rules)).toEqual([
      '--u-palette-primary',
      '--u-palette-faint',
      '--u-palette-mode',
    ])
    expect(rules['--u-palette-primary']).toContain('syntax:"<color>"')
    expect(rules['--u-palette-mode']).toContain('syntax:"*"')
  })

  it('registers only variable and reference tokens, never inline or raw ones', () => {
    const rules = register(
      { zIndex: true, space: true, breakpoints: '*', 'palette.primary': '<color>' },
      { modes: { zIndex: 'inline', 'palette.primary': 'reference', space: 'raw' } }
    )
    expect(Object.keys(rules)).toEqual(['--u-palette-primary'])
    expect(rules['--u-palette-primary']).toContain('initial-value:#0b57d0;')
  })

  it('writes the base value, not the var() fallback, for a reference token', () => {
    const { registrations } = createTokens(theme, {
      prefix: 'u',
      modes: { palette: 'reference' },
      registered: { 'palette.primary': true },
    })
    expect(registrations['--u-palette-primary']).toBe(
      '@property --u-palette-primary{syntax:"<color>";inherits:true;initial-value:#0b57d0;}'
    )
  })

  it('is empty without the option, and for a key that matches no token', () => {
    expect(createTokens(theme).registrations).toEqual({})
    expect(register({})).toEqual({})
    expect(register({ nothing: true })).toEqual({})
  })
})
