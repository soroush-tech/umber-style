import { createTokens } from './tokens'

const theme = {
  palette: { primary: '#0b57d0', accent: '#f90' },
  space: [0, 4, 8],
  zIndex: { modal: 100, tooltip: 200 },
  transitions: { duration: { short: 150 }, easing: 'ease' },
  breakpoints: { md: '600px' },
  components: { Button: { color: 'red' } },
  format: () => 'x',
}

describe('token modes', () => {
  it('is variable for every token, and raw for breakpoints and components, without modes', () => {
    const { refs, declare } = createTokens(theme, { prefix: 'u' })
    expect(refs.zIndex.modal).toBe('var(--u-z-index-modal)')
    expect(refs.breakpoints).toBe(theme.breakpoints)
    expect(declare(theme)['--u-z-index-modal']).toBe('100')
  })

  it('inline: the real value is in refs, with no declaration', () => {
    const { refs, declare } = createTokens(theme, { prefix: 'u', modes: { zIndex: 'inline' } })
    expect(refs.zIndex).toBe(theme.zIndex)
    expect(refs.zIndex.modal).toBe(100)
    expect(refs.palette.primary).toBe('var(--u-palette-primary)')
    expect(Object.keys(declare(theme)).some((name) => name.includes('z-index'))).toBe(false)
  })

  it('inline: a number under a length key is the real number, which a declaration writes in px', () => {
    const { refs, declare } = createTokens(theme, { prefix: 'u', modes: { space: 'inline' } })
    expect(refs.space).toBe(theme.space)
    expect(Object.keys(declare(theme)).some((name) => name.includes('space'))).toBe(false)
  })

  it('reference: a variable with the base value as its fallback, still declared', () => {
    const { refs, declare } = createTokens(theme, {
      prefix: 'u',
      modes: { 'palette.primary': 'reference', space: 'reference' },
    })
    expect(refs.palette.primary).toBe('var(--u-palette-primary, #0b57d0)')
    expect(refs.palette.accent).toBe('var(--u-palette-accent)')
    expect(refs.space[2]).toBe('var(--u-space-2, 8px)')
    expect(refs.space[0]).toBe('var(--u-space-0, 0)')
    expect(declare({ palette: { primary: 'red' } })).toEqual({ '--u-palette-primary': 'red' })
  })

  it('reference: a view of a nested theme keeps the base value as the fallback', () => {
    const tokens = createTokens(theme, { prefix: 'u', modes: { 'palette.primary': 'reference' } })
    const nested = { ...theme, palette: { ...theme.palette, primary: '#ff0000' } }
    expect(tokens.createView(nested).palette.primary).toBe('var(--u-palette-primary, #0b57d0)')
    expect(tokens.createView(nested).palette.accent).toBe('var(--u-palette-accent)')
  })

  it('reference: a token the base theme does not have gets no fallback', () => {
    const tokens = createTokens(theme, { prefix: 'u', modes: { palette: 'reference' } })
    const withExtra = { ...theme, palette: { ...theme.palette, extra: 'x' } }
    const view = tokens.createView(withExtra)
    expect((view.palette as Record<string, string>).extra).toBe('var(--u-palette-extra)')
  })

  it('raw: the real value, never declared', () => {
    const { refs, declare } = createTokens(theme, { prefix: 'u', modes: { transitions: 'raw' } })
    expect(refs.transitions).toBe(theme.transitions)
    expect(Object.keys(declare(theme)).some((name) => name.includes('transitions'))).toBe(false)
  })

  it('takes the most specific path: a leaf beats its parent, which beats the top-level key', () => {
    const { refs, declare } = createTokens(theme, {
      prefix: 'u',
      modes: {
        transitions: 'inline',
        'transitions.duration': 'variable',
        'transitions.duration.short': 'reference',
      },
    })
    expect(refs.transitions.easing).toBe('ease')
    expect(refs.transitions.duration.short).toBe('var(--u-transitions-duration-short, 150)')
    expect(declare(theme)).toMatchObject({ '--u-transitions-duration-short': '150' })
    expect(Object.keys(declare(theme)).filter((name) => name.includes('transitions'))).toEqual([
      '--u-transitions-duration-short',
    ])
  })

  it('takes a deeper variable inside a parent that is inline', () => {
    const { refs } = createTokens(theme, {
      prefix: 'u',
      modes: { zIndex: 'inline', 'zIndex.modal': 'variable' },
    })
    expect(refs.zIndex.modal).toBe('var(--u-z-index-modal)')
    expect(refs.zIndex.tooltip).toBe(200)
  })

  it('keeps the value of a leaf that has an entry deeper down', () => {
    const { refs } = createTokens({ a: 'x' }, { modes: { a: 'inline', 'a.b': 'raw' } })
    expect(refs.a).toBe('x')
  })

  it('keeps rawKeys working, and lets an entry in modes beat them', () => {
    const raw = createTokens(theme, { prefix: 'u', rawKeys: ['palette'] })
    expect(raw.refs.palette).toBe(theme.palette)
    const beaten = createTokens(theme, {
      prefix: 'u',
      rawKeys: ['palette'],
      modes: { 'palette.primary': 'variable' },
    })
    expect(beaten.refs.palette.primary).toBe('var(--u-palette-primary)')
    expect(beaten.refs.palette.accent).toBe('#f90')
    expect(Object.keys(beaten.declare(theme)).filter((name) => name.includes('palette'))).toEqual([
      '--u-palette-primary',
    ])
    const defaults = createTokens(theme, { prefix: 'u', modes: { components: 'variable' } })
    expect(defaults.refs.components.Button.color).toBe('var(--u-components-button-color)')
    expect(defaults.refs.breakpoints).toBe(theme.breakpoints)
  })

  it('does not take an entry from the prototype of modes', () => {
    const { refs } = createTokens(theme, { modes: { toString: 'raw' as const } })
    expect(refs.palette.primary).toBe('var(--palette-primary)')
  })

  it('finds the names of the declared tokens under paths', () => {
    const { findNames } = createTokens(theme, { prefix: 'u', modes: { zIndex: 'inline' } })
    expect(findNames(['space'])).toEqual(['--u-space-0', '--u-space-1', '--u-space-2'])
    expect(findNames(['palette.primary', 'transitions.duration'])).toEqual([
      '--u-palette-primary',
      '--u-transitions-duration-short',
    ])
    expect(findNames(['zIndex', 'spac', 'nothing'])).toEqual([])
  })
})
