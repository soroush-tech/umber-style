import { render } from '@testing-library/react'
import { EMPTY_THEME } from '@umber-style/core'
import type { NativeTheme } from './nativeTheme'
import { createThemeValue } from './ThemeValue'

const base = { a: { b: 1, c: 2 } }

/** A conversion that changes nothing. */
const keep = <T,>(theme: T) => theme as NativeTheme<T>

describe('createThemeValue', () => {
  it('merges a theme over the base of the holder, and over the provider above', () => {
    const { ThemeValueProvider, useTheme } = createThemeValue({ baseTheme: base }, keep)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <Probe />
        <ThemeValueProvider theme={{ a: { b: 5 } }}>
          <ThemeValueProvider theme={{ a: { c: 7 } }}>
            <Probe />
          </ThemeValueProvider>
        </ThemeValueProvider>
      </>
    )
    expect(seen[0]).toBe(base)
    expect(seen[1]).toEqual({ a: { b: 5, c: 7 } })
  })

  it('takes the theme as it is when there is no base, and gives an empty object without a provider, after one unmounted too', () => {
    const { ThemeValueProvider, useTheme } = createThemeValue<typeof base>(
      { baseTheme: undefined },
      keep
    )
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    const theme = { a: { b: 9, c: 9 } }
    render(
      <ThemeValueProvider theme={theme}>
        <Probe />
      </ThemeValueProvider>
    ).unmount()
    expect(seen[0]).toBe(theme)
    // The theme of a provider does not outlive it: a tree with no provider has the empty theme.
    render(<Probe />)
    expect(seen[1]).toBe(EMPTY_THEME)
    const empty = createThemeValue<typeof base>({ baseTheme: undefined }, keep)
    const Empty = () => {
      seen.push(empty.useTheme())
      return null
    }
    render(<Empty />)
    expect(seen[2]).toBe(EMPTY_THEME)
  })
})

describe('the converted theme', () => {
  type Spaced = { space: (string | number)[] }
  const double = (theme: Spaced) => ({ ...theme, space: theme.space.map((value) => `${value}!`) })

  it('converts each theme object once, not on each render, and remembers it for that object', () => {
    const convert = vi.fn(double)
    const holder = { baseTheme: { space: ['8px'] } as Spaced }
    const { ThemeValueProvider, useTheme } = createThemeValue(holder, convert)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    const theme = { space: ['4px'] }
    const tree = () => (
      <>
        <Probe />
        <ThemeValueProvider theme={theme}>
          <Probe />
          <Probe />
        </ThemeValueProvider>
      </>
    )
    const { rerender } = render(tree())
    rerender(tree())
    rerender(tree())
    // The base theme once, and the theme of the provider once.
    expect(convert).toHaveBeenCalledTimes(2)
    expect(seen[0]).toEqual({ space: ['8px!'] })
    expect(seen[1]).toEqual({ space: ['4px!'] })
    expect(seen[2]).toBe(seen[1])
    expect(seen[3]).toBe(seen[0])
  })

  it('merges, and gives a function theme, the theme above as it was given', () => {
    const { ThemeValueProvider, useTheme } = createThemeValue<Spaced>(
      { baseTheme: undefined },
      double
    )
    const outers: unknown[] = []
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <ThemeValueProvider theme={{ space: ['1px'] }}>
        <ThemeValueProvider
          theme={(outer) => {
            outers.push(outer)
            return { space: [...outer.space, '2px'] }
          }}
        >
          <Probe />
        </ThemeValueProvider>
      </ThemeValueProvider>
    )
    expect(outers).toEqual([{ space: ['1px'] }])
    expect(seen).toEqual([{ space: ['1px!', '2px!'] }])
  })

  it('takes a theme that the app put in the context itself as it is', () => {
    const { ThemeContext, ThemeValueProvider } = createThemeValue<Spaced>(
      { baseTheme: undefined },
      double
    )
    const outers: unknown[] = []
    render(
      <ThemeContext.Provider value={{ space: [3] }}>
        <ThemeValueProvider theme={(outer) => (outers.push(outer), {})}>{null}</ThemeValueProvider>
      </ThemeContext.Provider>
    )
    expect(outers).toEqual([{ space: [3] }])
  })
})
