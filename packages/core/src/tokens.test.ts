import { createTokens, findMissingPaths } from './tokens'

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

  it('names a variable from each key as it did: a key that is a part of a name already is kept as it is', () => {
    // How a key was made a part of a name before a key with nothing to rewrite was kept as it is.
    const toSegment = (key: string) =>
      key
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
    const keys = [
      'plain',
      'with-hyphen',
      'with_under',
      'abc123',
      '0',
      '',
      'camelCase',
      'ALL',
      'x.y',
    ]
    const more = ['sp ace', 'caf\u00e9', 'a\u{1f600}b', 'aZ9', '9Z', 'Z']
    const source = Object.fromEntries([...keys, ...more].map((key) => [key, 1]))
    const names = Object.keys(createTokens(source, { prefix: 'p' }).declare(source))
    const expected = Object.keys(source).map(
      (key) => `--${['p', toSegment(key)].filter(Boolean).join('-')}`
    )
    expect(names).toEqual([...new Set(expected)])
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

describe('findMissingPaths', () => {
  it('gives the paths that the theme does not have, through a leaf or a null value too', () => {
    const theme = { palette: { primary: '#000', none: null }, space: [0, 4] }
    expect(
      findMissingPaths(theme, [
        'palette',
        'palette.primary',
        'palette.*',
        'space.1',
        '*.primary',
        'palette.primary.dark',
        'palette.none.x',
        'space.2',
        '*.secondary',
      ])
    ).toEqual(['palette.primary.dark', 'palette.none.x', 'space.2', '*.secondary'])
  })
})
