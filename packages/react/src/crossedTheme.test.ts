import { type DeepPartial } from '@umber-style/core'
import { mergeTheme } from '@umber-style/core/internal'
import { mergeCrossed, type Crossing } from './crossedTheme'

/** Breakpoints of `sizes` with `up(key)`, a helper that is not enumerable and closes over the sizes, as a design system makes it. */
function withHelpers<S extends Record<string, string>>(sizes: S) {
  const breakpoints = { ...sizes }
  Object.defineProperty(breakpoints, 'up', {
    value: (key: keyof S) => `@media (min-width:${sizes[key]})`,
    enumerable: false,
  })
  return breakpoints as S & { up(key: keyof S): string }
}

/** A base theme of the client build with hidden helpers on its breakpoints. */
function createBase() {
  return {
    palette: { primary: '#0000ff', text: '#111111' },
    space: [0, 4, 8],
    breakpoints: withHelpers({ sm: '600px', md: '840px' }),
  }
}

let count = 0
let crossing: Crossing
beforeEach(() => {
  count += 1
  crossing = { prefix: `ct${count}`, tokens: { prefix: `ct${count}` }, isBase: true }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** `mergeCrossed`, typed by the theme below: a crossed theme of other values is still of its shape. */
function merge<T>(below: T, crossed: object, over: Crossing = crossing): T {
  return mergeCrossed(below, crossed as DeepPartial<T>, over)
}

/** Watches `console.warn` in development. */
function watchWarnings() {
  vi.stubEnv('NODE_ENV', 'development')
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined)
}

describe('mergeCrossed with raw values that are the same', () => {
  it('keeps the hidden helpers of the theme below, which give what they give there, and warns nothing', () => {
    const warn = watchWarnings()
    const base = createBase()
    const crossed = { palette: { primary: '#ff0000' }, breakpoints: { sm: '600px', md: '840px' } }
    const merged = merge(base, crossed, crossing)
    expect(merged.palette.primary).toBe('#ff0000')
    expect(merged.breakpoints.up('md')).toBe('@media (min-width:840px)')
    expect(merged.breakpoints.up('md')).toBe(base.breakpoints.up('md'))
    expect(merge(base, crossed, crossing)).toBe(merged)
    expect(warn).not.toHaveBeenCalled()
  })

  it('is the merge of mergeTheme where the theme below has no hidden member, or where either is no object', () => {
    const warn = watchWarnings()
    const base = { palette: { primary: '#0000ff' }, breakpoints: { md: '840px' } }
    const crossed = { breakpoints: { md: '900px' } }
    expect(merge(base, crossed, crossing)).toBe(mergeTheme(base, crossed))
    expect(mergeCrossed(undefined, crossed, crossing)).toBe(crossed)
    expect(mergeCrossed<unknown>(base, 'value', crossing)).toBe('value')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('mergeCrossed with a raw value that differs', () => {
  it('takes the member of the theme below with its enumerable members only, and warns once for each path, with both values and the fix', () => {
    const warn = watchWarnings()
    const base = createBase()
    const crossed = { breakpoints: { sm: '600px', md: '900px', lg: '1200px' } }
    const merged = merge(base, crossed, crossing)
    expect(merged.breakpoints).toEqual({ sm: '600px', md: '900px', lg: '1200px' })
    expect(Reflect.ownKeys(merged.breakpoints)).toEqual(['sm', 'md', 'lg'])
    expect('up' in merged.breakpoints).toBe(false)
    // The rest of the theme below is as it is.
    expect(merged.space).toBe(base.space)
    expect(base.breakpoints.up('md')).toBe('@media (min-width:840px)')
    expect(warn.mock.calls.map(([text]) => text)).toEqual([
      `[${crossing.prefix}] The theme of a server ThemeProvider has breakpoints.md = "900px", but the base theme of the client build has "840px": the client build does not have this theme. Register the same theme in a module the client loads, with getEngine().setTheme(theme), createStyle(theme) or configure({ theme }).`,
      `[${crossing.prefix}] The theme of a server ThemeProvider has breakpoints.lg = "1200px", but the base theme of the client build has undefined: the client build does not have this theme. Register the same theme in a module the client loads, with getEngine().setTheme(theme), createStyle(theme) or configure({ theme }).`,
    ])
    // Another crossed theme of the same contents gives the same theme, and warns no more.
    expect(merge(base, structuredClone(crossed), crossing)).toBe(merged)
    merge(base, { breakpoints: { md: '960px' } }, crossing)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('names the theme of the provider above when it is not the base theme, with the fix of a client file', () => {
    const warn = watchWarnings()
    const above = createBase()
    const merged = merge(above, { breakpoints: { md: '900px' } }, { ...crossing, isBase: false })
    expect('up' in merged.breakpoints).toBe(false)
    expect(warn.mock.calls[0][0]).toBe(
      `[${crossing.prefix}] The theme of a server ThemeProvider has breakpoints.md = "900px", but the theme of the provider above it has "840px": the helpers of that theme are made from other values, and they are left out. Give this theme to a ThemeProvider in a client file to read its own helpers in client components.`
    )
  })

  it('does the same in production, with no message', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const merged = merge(createBase(), { breakpoints: { md: '900px' } }, crossing)
    expect(merged.breakpoints).toEqual({ sm: '600px', md: '900px' })
    expect('up' in merged.breakpoints).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('what mergeCrossed compares', () => {
  it('never a token: a variable that differs keeps the hidden members of its member below', () => {
    const warn = watchWarnings()
    const palette = { primary: '#0000ff' }
    Object.defineProperty(palette, 'contrast', { value: () => '#ffffff', enumerable: false })
    const base = { palette: palette as typeof palette & { contrast(): string } }
    const merged = merge(base, { palette: { primary: '#ff0000' } }, crossing)
    expect(merged.palette.contrast()).toBe('#ffffff')
    expect(warn).not.toHaveBeenCalled()
  })

  it('a value that the token options make raw or a variable, and a value that is no token (a boolean)', () => {
    const warn = watchWarnings()
    const palette = { primary: '#0000ff', text: '#111111', isDark: false }
    Object.defineProperty(palette, 'contrast', { value: () => '#ffffff', enumerable: false })
    const base = { palette, breakpoints: withHelpers({ md: '840px' }) }
    const tokens = { modes: { 'palette.text': 'raw', 'breakpoints.md': 'variable' } } as const
    const merged = merge(
      base,
      { palette: { text: '#222222', isDark: true }, breakpoints: { md: '900px' } },
      { ...crossing, tokens }
    )
    expect(warn.mock.calls.map(([text]) => (text as string).split(':')[0])).toEqual([
      `[${crossing.prefix}] The theme of a server ThemeProvider has palette.text = "#222222", but the base theme of the client build has "#111111"`,
      `[${crossing.prefix}] The theme of a server ThemeProvider has palette.isDark = true, but the base theme of the client build has false`,
    ])
    expect('contrast' in merged.palette).toBe(false)
    // breakpoints.md is a variable here: its member keeps its helper.
    expect(merged.breakpoints.up('md')).toBe('@media (min-width:840px)')
  })

  it('with no token options, those of the engine by default: breakpoints and components are raw', () => {
    watchWarnings()
    const components = { Button: { size: 'small' } }
    Object.defineProperty(components.Button, 'render', { value: () => null, enumerable: false })
    const base = { breakpoints: withHelpers({ md: '840px' }), components }
    const merged = merge(
      base,
      { breakpoints: { md: '840px' }, components: { Button: { size: 'large' } } },
      { ...crossing, tokens: undefined }
    )
    expect(merged.breakpoints.up('md')).toBe('@media (min-width:840px)')
    expect(merged.components).toEqual({ Button: { size: 'large' } })
    expect('render' in merged.components.Button).toBe(false)
  })

  it('compares each value of an object given where the theme below has a value that is no object', () => {
    const warn = watchWarnings()
    const merged = merge(createBase(), { breakpoints: { md: { min: '900px' } } }, crossing)
    expect('up' in merged.breakpoints).toBe(false)
    expect(warn.mock.calls[0][0]).toContain(
      'has breakpoints.md.min = "900px", but the base theme of the client build has undefined'
    )
  })

  it('leaves a value given as undefined, which keeps the one below, out of the comparison', () => {
    const warn = watchWarnings()
    const base = createBase()
    const merged = merge(base, { breakpoints: { md: undefined } }, crossing)
    expect(merged.breakpoints.up('md')).toBe('@media (min-width:840px)')
    expect(warn).not.toHaveBeenCalled()
  })

  it('copies only lists and plain objects, and ends at a cycle, where the theme below has one', () => {
    watchWarnings()
    const breakpoints = withHelpers({ md: '840px' }) as Record<string, unknown>
    const bare = Object.assign(Object.create(null) as object, { width: 1 })
    const when = new Date(0)
    Object.assign(breakpoints, { self: breakpoints, list: [1, 2], bare, when })
    const base = { breakpoints }
    const merged = merge(base, { breakpoints: { md: '900px' } }, crossing)
    const copy = merged.breakpoints
    expect(copy).not.toBe(breakpoints)
    expect('up' in copy).toBe(false)
    expect(copy.self).toBe(breakpoints)
    expect(copy.list).toEqual([1, 2])
    expect(copy.bare).toEqual({ width: 1 })
    expect(copy.bare).not.toBe(bare)
    expect(copy.when).toBe(when)
  })
})
