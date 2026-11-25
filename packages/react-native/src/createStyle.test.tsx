import { render } from '@testing-library/react'
import { createElement, memo } from 'react'
import { expectTypeOf } from 'vitest'
import { alpha } from './alpha'
import { createStyle } from './createStyle'
import type { NativeTheme } from './nativeTheme'

const baseTheme = {
  palette: { primary: '#0000ff' },
  space: { small: 4 },
}

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

describe('styled on React Native', () => {
  it('passes a style array with real values and no web-only keys', () => {
    const { styled, ThemeProvider } = createStyle(baseTheme)
    const { View, calls } = createStandIn()
    const Box = styled(View, { name: 'Box' })(
      ({ theme }) => ({
        padding: theme.space.small,
        backgroundColor: theme.palette.primary,
        '&:hover': { color: 'red' },
      }),
      null as never,
      { margin: 2 }
    )
    render(<Box style={[{ opacity: 1 }, [{ flex: 1 }]]} tone="x" id="a" />)
    expect(calls[0].style).toEqual([
      { padding: 4, backgroundColor: '#0000ff' },
      { margin: 2 },
      { opacity: 1 },
      { flex: 1 },
    ])
    expect(calls[0].id).toBe('a')
    expect(calls[0].tone).toBe('x')
    expect(calls[0]).not.toHaveProperty('theme')

    render(
      <ThemeProvider theme={{ palette: { primary: '#ff0000' }, space: { small: 8 } }}>
        <Box />
      </ThemeProvider>
    )
    expect(calls[1].style).toEqual([{ padding: 8, backgroundColor: '#ff0000' }, { margin: 2 }])
  })

  it('renders the component of `as` and uses shouldForwardProp', () => {
    const { styled } = createStyle(baseTheme)
    const first = createStandIn()
    const second = createStandIn()
    const Box = styled(first.View, { shouldForwardProp: (prop) => prop === 'id' })({ margin: 1 })
    render(<Box as={second.View} id="a" title="b" />)
    expect(first.calls).toHaveLength(0)
    expect(second.calls[0]).toEqual({ id: 'a', style: [{ margin: 1 }] })
  })

  it('drops the animation of a styled component, whose name keyframes gives, and has a Global that renders nothing', () => {
    const { styled, keyframes, globalStyles, Global } = createStyle(baseTheme)
    const pulse = keyframes((theme) => ({ '50%': { opacity: 0.4, color: theme.palette.primary } }))
    expect(pulse).toMatch(/^keyframes-[a-z0-9]+$/)
    const { View, calls } = createStandIn()
    // A style written for the web, typed as an object, with its animation keys.
    const webStyle: object = {
      animation: `${pulse} 1.5s ease-in-out infinite`,
      transitionDuration: 200,
    }
    const Skeleton = styled(View)({ ...webStyle, opacity: 1 })
    const base = globalStyles((theme) => ({ body: { color: theme.palette.primary } }))
    const { container } = render(
      <>
        <Global styles={[base, { html: { margin: 0 } }]} />
        <Skeleton />
      </>
    )
    expect(calls[0].style).toEqual([{ opacity: 1 }])
    expect(container.innerHTML).toBe('<view></view>')
  })

  it('throws for a string tag when it is created', () => {
    const { styled } = createStyle(baseTheme)
    expect(() => styled('div')).toThrow(TypeError)
    expect(() => styled('div')).toThrow(
      'styled needs a component on React Native, not the tag "div".'
    )
  })
})

describe('useStyle on React Native', () => {
  it('returns plain objects, computed once for each theme', () => {
    const { StyleSheet, useStyle, ThemeProvider } = createStyle(baseTheme)
    const make = vi.fn((theme: typeof baseTheme) => ({
      box: { padding: theme.space.small, '&:hover': { color: 'red' }, label: 'x' },
    }))
    const sheet = StyleSheet.create(make)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(make).toHaveBeenCalledTimes(1)
    expect(seen[0]).toEqual({ box: { padding: 4 } })
    expect(seen[1]).toBe(seen[0])

    render(
      <ThemeProvider theme={{ space: { small: 8 } }}>
        <Probe />
      </ThemeProvider>
    )
    expect(make).toHaveBeenCalledTimes(2)
    expect(seen[2]).toEqual({ box: { padding: 8 } })
  })

  it('takes a plain object too', () => {
    const { StyleSheet, useStyle } = createStyle(baseTheme)
    const sheet = StyleSheet.create({ box: { margin: 1 } })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useStyle(sheet))
      return null
    }
    render(<Probe />)
    expect(seen[0]).toEqual({ box: { margin: 1 } })
  })

  it('apply returns a style array without the empty entries', () => {
    const { apply } = createStyle(baseTheme)
    expect(apply({ a: 1 } as never, null, undefined, false, { b: 2 } as never)).toEqual({
      style: [{ a: 1 }, { b: 2 }],
    })
  })
})

describe('the theme on React Native', () => {
  it('useTheme returns the base theme without a provider and the merged theme inside one', () => {
    const { useTheme, ThemeProvider, themeClass } = createStyle(baseTheme, { prefix: 'ignored' })
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    render(
      <>
        <Probe />
        <ThemeProvider theme={{ palette: { primary: '#ff0000' } }} colorScheme="dark" className="x">
          <Probe />
        </ThemeProvider>
      </>
    )
    expect(seen[0]).toBe(baseTheme)
    expect(seen[1]).toEqual({ palette: { primary: '#ff0000' }, space: { small: 4 } })
    expect(themeClass({}, 'dark')).toBe('')
  })

  it('alpha is the native one', () => {
    expect(alpha('#000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
  })
})

describe('a theme written for the web on React Native', () => {
  const up = (key: string) => `(min-width: ${key})`
  // A key that takes only a number (`borderWidth`, `fontSize`) needs a token whose type is a length
  // literal, which the converted theme types as a number; a plain `string` may still be text.
  const webTheme = {
    palette: { primary: '#1b5fd1' },
    space: ['0px', '4px', '8px'],
    radii: { sm: '2px', round: '50%' },
    borderWidths: { thin: '1px' as const },
    sizes: { full: '100%', fit: 'auto' },
    fontSizes: { body: '1rem' as const },
    breakpoints: Object.defineProperty(['40em', '64em'], 'up', { value: up }),
  }

  it('gives numbers in styles, in sheets and from useTheme; percentages, auto, colours and breakpoints stay', () => {
    const { styled, StyleSheet, useStyle, useTheme, ThemeProvider } = createStyle(webTheme)
    const { View, calls } = createStandIn()
    const Box = styled(View)(({ theme }) => ({
      padding: theme.space[2],
      borderRadius: theme.radii.sm,
      borderWidth: theme.borderWidths.thin,
      width: theme.sizes.full,
      height: theme.sizes.fit,
      fontSize: theme.fontSizes.body,
      backgroundColor: theme.palette.primary,
    }))
    const sheet = StyleSheet.create((theme) => ({ row: { gap: theme.space[1] } }))
    const themes: unknown[] = []
    const rows: unknown[] = []
    const Probe = () => {
      themes.push(useTheme())
      rows.push(useStyle(sheet).row)
      return <Box />
    }
    render(<Probe />)
    render(
      <ThemeProvider theme={{ space: ['0px', '6px', '12px'] }}>
        <Probe />
      </ThemeProvider>
    )
    const expected = {
      padding: 8,
      borderRadius: 2,
      borderWidth: 1,
      width: '100%',
      height: 'auto',
      fontSize: 16,
      backgroundColor: '#1b5fd1',
    }
    expect(calls[0].style).toEqual([expected])
    expect(calls[1].style).toEqual([{ ...expected, padding: 12 }])
    expect(rows).toEqual([{ gap: 4 }, { gap: 6 }])
    const [base, nested] = themes as (typeof webTheme)[]
    expect(base.space).toEqual([0, 4, 8])
    expect(base.radii).toEqual({ sm: 2, round: '50%' })
    expect(nested.space).toEqual([0, 6, 12])
    expect(base.breakpoints).toBe(webTheme.breakpoints)
    expect(nested.breakpoints).toEqual(['40em', '64em'])
    expect((nested.breakpoints as unknown as { up: unknown }).up).toBe(up)
  })

  it('converts the theme once, not on each render: useTheme returns the same object', () => {
    const { useTheme, ThemeProvider } = createStyle(webTheme)
    const seen: unknown[] = []
    const Probe = () => {
      seen.push(useTheme())
      return null
    }
    const nested = { radii: { sm: '3px' } }
    const tree = () => (
      <ThemeProvider theme={nested}>
        <Probe />
      </ThemeProvider>
    )
    const { rerender } = render(tree())
    rerender(tree())
    expect(seen[1]).toBe(seen[0])
    expect((seen[0] as NativeTheme<typeof webTheme>).radii.sm).toBe(3)
  })

  it('converts literals in styles: object styles once, when registered; function styles on each call', () => {
    const { styled } = createStyle(webTheme)
    const { View, calls } = createStandIn()
    // The platform types an opacity as a number: a style written for the web may hold a string.
    const Box = styled(View)<{ isWide?: boolean }>(
      { margin: '4px', opacity: '0.5' } as never,
      ({ isWide }) => ({ padding: isWide ? '1rem' : '8px' })
    )
    render(<Box />)
    render(<Box isWide />)
    expect(calls.map((call) => call.style)).toEqual([
      [{ margin: 4, opacity: 0.5 }, { padding: 8 }],
      [{ margin: 4, opacity: 0.5 }, { padding: 16 }],
    ])
  })

  it('multiplies rem by the remBase option', () => {
    const { styled, useTheme } = createStyle(webTheme, { remBase: 10 })
    const { View, calls } = createStandIn()
    const Box = styled(View)({ padding: '2rem' })
    let fontSize: unknown
    const Probe = () => {
      fontSize = useTheme().fontSizes.body
      return <Box />
    }
    render(<Probe />)
    expect(calls[0].style).toEqual([{ padding: 20 }])
    expect(fontSize).toBe(10)
  })

  it('converts the keys of the lengthKeys option instead of the default ones', () => {
    const { useTheme } = createStyle(
      { space: ['8px'], lineHeights: { tight: '20px' } },
      { lengthKeys: ['lineHeights'] }
    )
    let seen: unknown
    const Probe = () => {
      seen = useTheme()
      return null
    }
    render(<Probe />)
    expect(seen).toEqual({ space: ['8px'], lineHeights: { tight: 20 } })
  })

  it('types the theme that is read with lengths as numbers', () => {
    const { styled, useTheme, StyleSheet } = createStyle({
      space: ['0px', '4px'] as const,
      radii: { sm: '2px' },
      palette: { primary: '#1b5fd1' },
    })
    const { View } = createStandIn()
    styled(View)(({ theme }) => {
      expectTypeOf(theme.space).toEqualTypeOf<readonly [number, number]>()
      expectTypeOf(theme.radii.sm).toEqualTypeOf<string | number>()
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      return { padding: theme.space[1] }
    })
    StyleSheet.create((theme) => {
      expectTypeOf(theme.space[1]).toEqualTypeOf<number>()
      return { box: { margin: theme.space[1] } }
    })
    expectTypeOf<ReturnType<typeof useTheme>['space']>().toEqualTypeOf<readonly [number, number]>()
  })
})

describe('the development warnings of styled and sheets on React Native', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const messages = (warn: { mock: { calls: unknown[][] } }) =>
    warn.mock.calls.map(([text]) => String(text).split(' is dropped')[0])

  it('name the component: its name option, else its display name, else its function name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { styled } = createStyle(baseTheme)
    const { View } = createStandIn()
    const Shown = Object.assign((props: Props) => View(props), { displayName: 'Shown' })
    const Anonymous = memo(View)
    const Named = styled(View, { name: 'Named' })({ '&:hover': { opacity: 1 } } as never)
    const ByDisplayName = styled(Shown)({ ':focus': { opacity: 1 } } as never)
    const ByFunctionName = styled(View)(() => ({ '--gap': 4 }) as never)
    const Unnamed = styled(Anonymous)({ animationName: 'spin' } as never)
    render(
      <>
        <Named />
        <ByDisplayName />
        <ByFunctionName />
        <Unnamed />
      </>
    )
    expect(messages(warn)).toEqual([
      '@umber-style/react-native: Named: "&:hover"',
      '@umber-style/react-native: Shown: ":focus"',
      '@umber-style/react-native: "animationName"',
      '@umber-style/react-native: View: "--gap"',
    ])
  })

  it('name the entry of a sheet, registered or resolved against a condition', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { StyleSheet, useStyle, whenScheme } = createStyle(baseTheme)
    const sheet = StyleSheet.create({ card: { '&:active': { opacity: 1 } } as never })
    const themed = StyleSheet.create(() => ({
      panel: { [whenScheme('light')]: { '@container (width > 1px)': { margin: 1 } } } as never,
    }))
    const Probe = () => {
      useStyle(themed)
      return null
    }
    expect(sheet.card).toEqual({})
    render(<Probe />)
    expect(messages(warn)).toEqual([
      '@umber-style/react-native: sheet entry "card": "&:active"',
      '@umber-style/react-native: sheet entry "panel": "@container (width > 1px)"',
    ])
  })
})
