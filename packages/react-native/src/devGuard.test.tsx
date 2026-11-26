import { render } from '@testing-library/react'
import { createElement } from 'react'
import { keyframes } from '@umber-style/core'
import { animated } from './animated'
import { createStyle } from './createStyle'
import { guardTheme, readStyleOwner } from './devGuard'
import { toNativeStyle } from './toNativeStyle'

const theme = { palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4, 8] }
type AppTheme = typeof theme
type Props = Record<string, unknown>

const NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = NODE_ENV
})

/** A stand-in for a native component named `name`: it records the props it gets. */
function createStandIn(name = 'View') {
  const calls: Props[] = []
  const View = (props: Props) => {
    calls.push(props)
    return createElement('view')
  }
  Object.defineProperty(View, 'name', { value: name })
  return { View, calls }
}

/** What rendering `element` throws, with React's report of it kept out of the output. */
function readThrown(element: ReturnType<typeof createElement>): unknown {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(element)
  } catch (thrown) {
    return thrown
  } finally {
    error.mockRestore()
  }
  return undefined
}

describe('the argument of the style functions of an element on React Native', () => {
  it('is one object for the functions of an element in a render, another for each element and render', () => {
    for (const environment of ['development', 'production']) {
      process.env.NODE_ENV = environment
      const { styled } = createStyle(theme)
      const { View } = createStandIn()
      const seen: object[][] = []
      const Box = styled(View)<{ tone: string }>(
        (argument) => {
          seen.push([argument])
          return { color: argument.tone }
        },
        (argument) => {
          seen.at(-1)?.push(argument)
          return { padding: argument.theme.space[1] }
        }
      )
      const page = (
        <>
          <Box tone="red" />
          <Box tone="blue" />
        </>
      )
      render(page).unmount()
      render(page).unmount()
      expect(seen).toHaveLength(4)
      for (const [one, other] of seen) expect(one).toBe(other)
      expect(new Set(seen.map(([one]) => one)).size).toBe(4)
      expect(Object.isFrozen(seen[0][0])).toBe(environment === 'development')
    }
  })

  it('in development, throws when a style function changes it, naming the component', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn('Card')
    const Card = styled(View)<{ tone?: string }>((argument) => {
      ;(argument as { tone?: string }).tone = 'red'
      return null
    })
    expect(String(readThrown(<Card />))).toBe(
      'TypeError: @umber-style/react-native: A style function of "Card" threw a TypeError of a write into a frozen object: Cannot add property tone, object is not extensible. In development the argument of a style function is frozen: it is one object, the props with the theme, shared by the style functions of the element in a render. Copy the argument before changing it: const own = { ...props }.'
    )
    expect(readStyleOwner(undefined)).toBe('@umber-style/react-native: A style function')
  })

  it('in production, takes the change: the later functions see it', () => {
    process.env.NODE_ENV = 'production'
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)<{ tone?: string }>(
      (argument) => {
        ;(argument as { tone?: string }).tone = 'red'
        return null
      },
      (argument) => ({ color: argument.tone })
    )
    render(<Box />)
    expect(calls[0].style).toEqual([{ color: 'red' }])
  })
})

describe('the theme that the functions of a React Native app get', () => {
  it('in development, throws on a write from a style function, a sheet, a provider function and keyframes', () => {
    const { styled, StyleSheet, ThemeProvider, useStyle } = createStyle(theme)
    const { View } = createStandIn('Card')
    const Card = styled(View)(({ theme: given }) => {
      given.space.push(16)
      return null
    })
    expect(String(readThrown(<Card />))).toBe(
      'TypeError: @umber-style/react-native: theme.space.3 is set by a function of "Card". The theme is one object, shared by every render and every request, so a change to it reaches all of them: never change it. Build a new object instead, such as [...theme.space].'
    )
    const sheet = StyleSheet.create((given: AppTheme) => {
      given.palette.primary = '#ff0000'
      return { root: {} }
    })
    const Sheet = () => {
      useStyle(sheet)
      return null
    }
    expect(String(readThrown(<Sheet />))).toContain(
      'theme.palette.primary is set by a function of "StyleSheet".'
    )
    const provided = (
      <ThemeProvider
        theme={(outer: AppTheme) => {
          delete (outer as Partial<AppTheme>).palette
          return {}
        }}
      >
        <i />
      </ThemeProvider>
    )
    expect(String(readThrown(provided))).toContain(
      'theme.palette is deleted by a function of "ThemeProvider".'
    )
    const glow = keyframes(
      (given: AppTheme) => {
        given.palette.text = '#000000'
        return { to: { opacity: 1 } }
      },
      { label: 'glow' }
    )
    const motion = animated.bind({ remBase: 16, readTheme: () => theme })
    expect(() =>
      toNativeStyle({ animationName: glow }, undefined, { remBase: 16, name: 'Glow', motion })
    ).toThrow(`theme.palette.text is set by a function of "keyframes ${glow}".`)
    expect(theme).toEqual({ palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4, 8] })
  })

  it('in production, is the theme itself', () => {
    process.env.NODE_ENV = 'production'
    expect(guardTheme(theme, 'Card')).toBe(theme)
    const { ThemeProvider } = createStyle(theme)
    let given: unknown
    render(
      <ThemeProvider
        theme={(outer: AppTheme) => {
          given = outer
          return {}
        }}
      >
        <i />
      </ThemeProvider>
    )
    expect(given).toBe(theme)
    expect(readStyleOwner('Card')).toBeUndefined()
  })
})
