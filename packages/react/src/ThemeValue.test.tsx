import { render } from '@testing-library/react'
import { NO_THEME_MESSAGE } from '@umber-style/core'
import { createThemeValue } from './ThemeValue'

const base = { a: { b: 1, c: 2 } }

describe('createThemeValue', () => {
  it('merges a theme over the base of the holder, and over the provider above', () => {
    const { ThemeValueProvider, useTheme } = createThemeValue({ baseTheme: base })
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

  it('takes the theme as it is when there is no base, and throws without a provider', () => {
    const { ThemeValueProvider, useTheme } = createThemeValue<typeof base>({ baseTheme: undefined })
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
    )
    expect(seen[0]).toBe(theme)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Probe />)).toThrow(NO_THEME_MESSAGE)
  })
})
