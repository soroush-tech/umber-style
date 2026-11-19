import { createTokens } from './tokens'

const theme = {
  palette: { primary: '#0b57d0', ramp: ['#111', '#222'] },
  space: [0, 4, 8],
  fontSizes: { 'x-large': 20, small: '0.8rem' },
  lineHeights: { body: 1.5 },
  radii: { '0.5': 2 },
  breakpoints: { md: '600px' },
  components: { Button: { color: 'red' } },
  isDense: true,
  nothing: null,
  fn: () => 'x',
  created: new Date(0),
  emptyHole: undefined,
}

describe('createTokens', () => {
  it('replaces each leaf in refs with a variable reference', () => {
    const { refs } = createTokens(theme)
    expect(refs.palette.primary).toBe('var(--palette-primary)')
    expect(refs.palette.ramp).toEqual(['var(--palette-ramp-0)', 'var(--palette-ramp-1)'])
    expect(refs.space[2]).toBe('var(--space-2)')
    expect(refs.fontSizes['x-large']).toBe('var(--font-sizes-x-large)')
    expect(refs.lineHeights.body).toBe('var(--line-heights-body)')
  })

  it('keeps raw keys, functions, booleans, null and class instances as they are', () => {
    const { refs } = createTokens(theme)
    expect(refs.breakpoints).toEqual({ md: '600px' })
    expect(refs.components).toEqual({ Button: { color: 'red' } })
    expect(refs.fn).toBe(theme.fn)
    expect(refs.isDense).toBe(true)
    expect(refs.nothing).toBeNull()
    expect(refs.created).toBe(theme.created)
    expect(refs.emptyHole).toBeUndefined()
  })

  it('puts the prefix before every name', () => {
    const { refs, declare } = createTokens(theme, { prefix: 'ds' })
    expect(refs.palette.primary).toBe('var(--ds-palette-primary)')
    expect(declare({ palette: { primary: 'red' } })).toEqual({ '--ds-palette-primary': 'red' })
  })

  it('declares every leaf, skipping raw keys and values that are not leaves', () => {
    expect(createTokens(theme).declare(theme)).toEqual({
      '--palette-primary': '#0b57d0',
      '--palette-ramp-0': '#111',
      '--palette-ramp-1': '#222',
      '--space-0': '0',
      '--space-1': '4px',
      '--space-2': '8px',
      '--font-sizes-x-large': '20px',
      '--font-sizes-small': '0.8rem',
      '--line-heights-body': '1.5',
      '--radii-0-5': '2px',
    })
  })

  it('declares only the leaves of a partial theme', () => {
    expect(createTokens(theme).declare({ palette: { primary: 'red' } })).toEqual({
      '--palette-primary': 'red',
    })
  })

  it('honours custom raw and length keys', () => {
    const { declare } = createTokens(theme, { rawKeys: ['palette'], lengthKeys: ['lineHeights'] })
    expect(declare({ palette: { primary: 'red' }, lineHeights: { body: 2 } })).toEqual({
      '--line-heights-body': '2px',
    })
  })
})
