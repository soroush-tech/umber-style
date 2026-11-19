import { render } from '@testing-library/react'
import { createElement } from 'react'
import { Appearance } from 'react-native'
import { createNativeThemeKey, matchesCondition, readSchemeName } from './conditions'
import { createStyle } from './createStyle'
import { hasConditions, toNativeStyle } from './toNativeStyle'

const base = { palette: { primary: '#0000ff' } }
const dark = { palette: { primary: '#8888ff' } }
const other = { palette: { primary: '#00ff00' } }

type Props = Record<string, unknown>

/** A stand-in for a native component: it records the props it gets. */
function createStandIn() {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view')
  }
  return { View, calls }
}

const getScheme = vi.mocked(Appearance.getColorScheme)

afterEach(() => getScheme.mockReturnValue('light'))

describe('the keys of when()', () => {
  it('names a theme object once, and each theme object apart', () => {
    const { when, whenScheme } = createStyle(base)
    expect(when(dark)).toBe(when(dark))
    expect(when(dark, 'dark')).toBe(when(dark))
    expect(when(dark)).not.toBe(when(other))
    expect(when(dark)).toMatch(/^@theme n\d+$/)
    expect(whenScheme('dark')).toBe('@scheme dark')
    expect(createNativeThemeKey(dark)).toBe(when(dark))
  })

  it('reads light and dark as a scheme, and nothing else', () => {
    expect(readSchemeName('dark')).toBe('dark')
    expect(readSchemeName('light')).toBe('light')
    expect(readSchemeName('light dark')).toBeUndefined()
    expect(readSchemeName(undefined)).toBeUndefined()
  })

  it('matches nothing for another key, or without a condition to match against', () => {
    expect(matchesCondition('color', { theme: dark, colorScheme: 'dark' })).toBe(false)
    expect(matchesCondition(createNativeThemeKey(dark), undefined)).toBe(false)
    expect(matchesCondition('@theme nope', { theme: dark, colorScheme: undefined })).toBe(false)
  })
})

describe('toNativeStyle with conditions', () => {
  it('merges the matching parts over the rest, and drops the others and the key itself', () => {
    const style = {
      padding: 8,
      [createNativeThemeKey(dark)]: { padding: 4, margin: 1 },
      [createNativeThemeKey(other)]: { padding: 99 },
      '@scheme dark': { opacity: 0.5 },
    }
    expect(toNativeStyle(style)).toEqual({ padding: 8 })
    expect(toNativeStyle(style, { theme: dark, colorScheme: 'dark' })).toEqual({
      padding: 4,
      margin: 1,
      opacity: 0.5,
    })
    expect(toNativeStyle(style, { theme: other, colorScheme: 'light' })).toEqual({ padding: 99 })
  })

  it('takes a condition that is inside another, and one in the native part', () => {
    const key = createNativeThemeKey(dark)
    const style = {
      native: { [key]: { '@scheme light': { opacity: 0.2 }, margin: 3 } },
      web: { x: 1 },
    }
    expect(toNativeStyle(style, { theme: dark, colorScheme: 'light' })).toEqual({
      margin: 3,
      opacity: 0.2,
    })
    expect(toNativeStyle(style, { theme: dark, colorScheme: 'dark' })).toEqual({ margin: 3 })
  })

  it('skips a part that is not an object, as `isOpen && { ... }` gives', () => {
    const style = { padding: 1, [createNativeThemeKey(dark)]: false }
    expect(toNativeStyle(style, { theme: dark, colorScheme: undefined })).toEqual({ padding: 1 })
  })

  it('tells a style that has a condition key, in its native part too', () => {
    expect(hasConditions({ padding: 1 })).toBe(false)
    expect(hasConditions({ native: { padding: 1 } })).toBe(false)
    expect(hasConditions({ '@scheme dark': {} })).toBe(true)
    expect(hasConditions({ native: { [createNativeThemeKey(dark)]: {} } })).toBe(true)
  })
})

describe('styled with when() and whenScheme()', () => {
  it('matches the nearest provider by the identity of its theme object', () => {
    const { styled, when, ThemeProvider } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ padding: 8, [when(dark)]: { padding: 4 } })
    const Plain = styled(View)({ margin: 1 })
    render(
      <>
        <Card />
        <ThemeProvider theme={dark}>
          <Card />
          <ThemeProvider theme={other}>
            <Card />
            <ThemeProvider theme={dark}>
              <Card />
              <Plain />
            </ThemeProvider>
          </ThemeProvider>
        </ThemeProvider>
      </>
    )
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 8 }],
      [{ padding: 4 }],
      [{ padding: 8 }],
      [{ padding: 4 }],
      [{ margin: 1 }],
    ])
  })

  it('counts the base theme as the nearest when no provider is above', () => {
    const { styled, when } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ padding: 8, [when(base)]: { padding: 2 } })
    render(<Card />)
    expect(calls[0].style).toEqual([{ padding: 2 }])
  })

  it('matches the colorScheme of the nearest provider that has one', () => {
    const { styled, whenScheme, ThemeProvider } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ opacity: 1, [whenScheme('dark')]: { opacity: 0.5 } })
    render(
      <ThemeProvider theme={dark} colorScheme="dark">
        <Card />
        <ThemeProvider theme={other}>
          <Card />
          <ThemeProvider theme={other} colorScheme="light">
            <Card />
            <ThemeProvider theme={other} colorScheme="light dark">
              <Card />
            </ThemeProvider>
          </ThemeProvider>
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(calls.map((call) => call.style)).toEqual([
      [{ opacity: 0.5 }],
      [{ opacity: 0.5 }],
      [{ opacity: 1 }],
      [{ opacity: 1 }],
    ])
  })

  it('reads the platform color scheme when no provider has one', () => {
    const { styled, whenScheme, ThemeProvider } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)({ opacity: 1, [whenScheme('dark')]: { opacity: 0.5 } })
    render(<Card />)
    getScheme.mockReturnValue('dark')
    render(<Card />)
    render(
      <ThemeProvider theme={dark}>
        <Card />
      </ThemeProvider>
    )
    getScheme.mockReturnValue(null)
    render(<Card />)
    expect(calls.map((call) => call.style)).toEqual([
      [{ opacity: 1 }],
      [{ opacity: 0.5 }],
      [{ opacity: 0.5 }],
      [{ opacity: 1 }],
    ])
  })

  it('resolves the conditions of a function style, and keeps the style given to the component', () => {
    const { styled, when, ThemeProvider } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)(({ theme }) => ({
      padding: theme.palette.primary === '#8888ff' ? 1 : 2,
      [when(dark)]: { margin: 5 },
    }))
    render(
      <ThemeProvider theme={dark}>
        <Card style={{ opacity: 1 }} />
      </ThemeProvider>
    )
    expect(calls[0].style).toEqual([{ padding: 1, margin: 5 }, { opacity: 1 }])
  })

  it('needs no theme for a component that only has a condition', () => {
    const { styled, whenScheme } = createStyle(base)
    const { View, calls } = createStandIn()
    const Card = styled(View)(null as never, { [whenScheme('light')]: { opacity: 0.3 } })
    render(<Card />)
    expect(calls[0].style).toEqual([{ opacity: 0.3 }])
  })
})

describe('a sheet with when() and whenScheme()', () => {
  it('resolves the conditional entries against the providers, and keeps the others registered', () => {
    const { StyleSheet, useStyle, when, ThemeProvider } = createStyle(base)
    const sheet = StyleSheet.create({
      card: { padding: 8, [when(dark)]: { padding: 4 } },
      plain: { margin: 1 },
    })
    const seen: Record<string, unknown>[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    render(
      <>
        <Probe />
        <ThemeProvider theme={dark}>
          <Probe />
        </ThemeProvider>
      </>
    )
    expect(seen[0]).toEqual({ card: { padding: 8 }, plain: { margin: 1 } })
    expect(seen[1]).toEqual({ card: { padding: 4 }, plain: { margin: 1 } })
    expect(seen[0].plain).toBe(seen[1].plain)
  })

  it('does the same for a sheet made from the theme, and returns one object when nothing is conditional', () => {
    const { StyleSheet, useStyle, whenScheme, ThemeProvider } = createStyle(base)
    const sheet = StyleSheet.create((theme) => ({
      card: { color: theme.palette.primary, [whenScheme('dark')]: { opacity: 0.5 } },
    }))
    const fixed = StyleSheet.create({ box: { margin: 2 } })
    const seen: Record<string, unknown>[] = []
    const fixedSeen: Record<string, unknown>[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      fixedSeen.push(useStyle(fixed))
      return null
    }
    render(
      <ThemeProvider theme={dark} colorScheme="dark">
        <Probe />
        <ThemeProvider theme={dark} colorScheme="light">
          <Probe />
        </ThemeProvider>
      </ThemeProvider>
    )
    expect(seen[0]).toEqual({ card: { color: '#8888ff', opacity: 0.5 } })
    expect(seen[1]).toEqual({ card: { color: '#8888ff' } })
    expect(fixedSeen[0]).toBe(fixedSeen[1])
  })
})
