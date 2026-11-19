import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { createCache, createMemorySheet } from './index'
import {
  multiply as multiplyWeb,
  negate as negateWeb,
  createStyle as createWebStyle,
} from './react'
import {
  multiply as multiplyNative,
  negate as negateNative,
  createStyle as createNativeStyle,
} from './react-native'
import type * as Shared from './shared'

const theme = {
  palette: { primary: '#0000ff', hover: '#000080' },
  space: [0, 4, 8],
}

/** The one source of the components: it takes the binding it runs on, and its host component. */
function createComponents(
  binding: ReturnType<typeof createWebStyle<typeof theme>>,
  Host: string | ((props: Record<string, unknown>) => unknown)
) {
  const { styled, StyleSheet, useStyle } = binding
  const Button = styled(Host as never, { name: 'Button' })(
    ({ theme: refs }: { theme: typeof theme }) => ({
      background: refs.palette.primary,
      borderRadius: 8,
      padding: refs.space[1],
      '&:hover:not(:disabled)': { background: refs.palette.hover },
    })
  )
  const View = styled(Host as never)()
  const sheet = StyleSheet.create((refs: typeof theme) => ({
    container: { padding: refs.space[2] },
    active: { background: refs.palette.primary },
    custom: { background: 'rebeccapurple', borderRadius: 0 },
    hover: { '&:hover:not(:disabled)': { background: 'rebeccapurple' } },
  }))

  function Panel({ isActive }: { isActive?: boolean }) {
    const styles = useStyle(sheet)
    return (
      <View style={[styles.container, isActive && styles.active, { opacity: 0.9 }]}>panel</View>
    )
  }

  function Custom({ withHover }: { withHover?: boolean }) {
    const styles = useStyle(sheet)
    return (
      <Button variant="filled" style={[styles.custom, withHover && styles.hover]}>
        custom
      </Button>
    )
  }
  return { Panel, Custom }
}

/** A stand-in for a native component: it records the props it gets. */
function createStandIn() {
  const calls: Record<string, unknown>[] = []
  const View = (props: Record<string, unknown>) => {
    calls.push(props)
    return createElement('view')
  }
  return { View, calls }
}

function setupWeb() {
  const sheet = createMemorySheet()
  const binding = createWebStyle(theme, { prefix: 'u', cache: createCache({ prefix: 'u', sheet }) })
  const ruleOf = (className: string) =>
    sheet.rules.filter((rule) => rule.includes(`.${className}{`) || rule.includes(`.${className}:`))
  return { binding, ruleOf }
}

describe('one component source on the web', () => {
  it('gives the View no class of its own, one override class for the entries and the plain object, and no style attribute', () => {
    const { binding, ruleOf } = setupWeb()
    const { Panel } = createComponents(binding, 'div')
    render(<Panel isActive />)
    const element = screen.getByText('panel')
    expect(element.className.split(' ')).toHaveLength(1)
    expect(ruleOf(element.className)).toEqual([
      `@layer u-overrides{.${element.className}{padding:var(--u-space-2);background:var(--u-palette-primary);opacity:0.9;}}`,
    ])
    expect(element.hasAttribute('style')).toBe(false)
  })

  it('drops the entry that is not active', () => {
    const { binding, ruleOf } = setupWeb()
    const { Panel } = createComponents(binding, 'div')
    render(<Panel />)
    const element = screen.getByText('panel')
    expect(ruleOf(element.className).join('')).not.toContain('background')
  })

  it('overrides the styles of a Button through style, in a second class that keeps the label', () => {
    const { binding, ruleOf } = setupWeb()
    const { Custom } = createComponents(binding, 'button')
    render(<Custom />)
    const [component, override, ...rest] = screen.getByText('custom').className.split(' ')
    expect(rest).toEqual([])
    expect(component).toMatch(/^u-button-root-/)
    expect(override).toMatch(/^u-button-root-/)
    expect(ruleOf(component)).toEqual([
      `@layer u-components{.${component}{background:var(--u-palette-primary);border-radius:8px;padding:var(--u-space-1);}}`,
      `@layer u-components{.${component}:hover:not(:disabled){background:var(--u-palette-hover);}}`,
    ])
    // The override is in a later layer, so its background beats the hover background of the Button.
    expect(ruleOf(override)).toEqual([
      `@layer u-overrides{.${override}{background:rebeccapurple;border-radius:0;}}`,
    ])
  })

  it('overrides the hover background when the entry has its own hover rule too', () => {
    const { binding, ruleOf } = setupWeb()
    const { Custom } = createComponents(binding, 'button')
    render(<Custom withHover />)
    const override = screen.getByText('custom').className.split(' ')[1]
    expect(ruleOf(override)).toContain(
      `@layer u-overrides{.${override}:hover:not(:disabled){background:rebeccapurple;}}`
    )
  })
})

describe('the same component source on React Native', () => {
  it('passes a flat style array of real values, the entries after the Button styles', () => {
    const binding = createNativeStyle(theme)
    const { View, calls } = createStandIn()
    const { Panel, Custom } = createComponents(
      binding as unknown as ReturnType<typeof createWebStyle<typeof theme>>,
      View
    )
    render(
      <>
        <Panel isActive />
        <Panel />
        <Custom />
      </>
    )
    expect(calls[0].style).toEqual([{ padding: 8 }, { background: '#0000ff' }, { opacity: 0.9 }])
    expect(calls[1].style).toEqual([{ padding: 8 }, { opacity: 0.9 }])
    // The nested hover rule is dropped on native; the entry comes after the Button styles and wins.
    expect(calls[2].style).toEqual([
      { background: '#0000ff', borderRadius: 8, padding: 4 },
      { background: 'rebeccapurple', borderRadius: 0 },
    ])
  })
})

type Helpers = Pick<typeof Shared, 'multiply' | 'negate'>

/** The one source of a component that does arithmetic on tokens; the helpers are the ones of the platform. */
function createSpacing(
  binding: ReturnType<typeof createWebStyle<typeof theme>>,
  Host: string | ((props: Record<string, unknown>) => unknown),
  { multiply, negate }: Helpers
) {
  const Spaced = binding.styled(Host as never)(({ theme: refs }: { theme: typeof theme }) => ({
    padding: multiply(refs.space[1], 2),
    marginLeft: negate(refs.space[2]),
  }))
  return function Spacing() {
    return <Spaced>spacing</Spaced>
  }
}

describe('arithmetic on tokens in one component source', () => {
  it('computes in the browser on the web', () => {
    const { binding, ruleOf } = setupWeb()
    const Spacing = createSpacing(binding, 'div', {
      multiply: multiplyWeb as unknown as Helpers['multiply'],
      negate: negateWeb as unknown as Helpers['negate'],
    })
    render(<Spacing />)
    const { className } = screen.getByText('spacing')
    expect(ruleOf(className)).toEqual([
      `@layer u-components{.${className}{padding:calc(var(--u-space-1) * 2);margin-left:calc(var(--u-space-2) * -1);}}`,
    ])
  })

  it('gives the real numbers on React Native', () => {
    const { View, calls } = createStandIn()
    const Spacing = createSpacing(
      createNativeStyle(theme) as unknown as ReturnType<typeof createWebStyle<typeof theme>>,
      View,
      {
        multiply: multiplyNative as unknown as Helpers['multiply'],
        negate: negateNative as unknown as Helpers['negate'],
      }
    )
    render(<Spacing />)
    expect(calls[0].style).toEqual([{ padding: 8, marginLeft: -8 }])
  })
})

const darkTheme = { palette: { primary: '#8888ff', hover: '#ccccff' }, space: [0, 4, 8] }

/** The one source of a component that differs in a dark theme and in a dark color scheme. */
function createConditional(
  binding: ReturnType<typeof createWebStyle<typeof theme>>,
  Host: string | ((props: Record<string, unknown>) => unknown)
) {
  const { styled, when, whenScheme } = binding
  const Card = styled(Host as never)({
    padding: 8,
    [when(darkTheme)]: { padding: 4 },
    [whenScheme('dark')]: { opacity: 0.5 },
  })
  return function Conditional() {
    return <Card>card</Card>
  }
}

describe('theme conditions in one component source', () => {
  it('compiles to a scoped rule and a scheme rule on the web', () => {
    const { binding, ruleOf } = setupWeb()
    const Conditional = createConditional(binding, 'div')
    render(<Conditional />)
    const { className } = screen.getByText('card')
    const id = binding.engine.themeId(darkTheme)
    expect(ruleOf(className)).toEqual([
      `@layer u-components{.${className}{padding:8px;}}`,
      `@layer u-components{@scope (.${id}) to (.u-boundary){.${className}{padding:4px;}}}`,
      `@layer u-components{@scope (.u-scheme-dark) to (.u-scheme-light,.u-scheme-dark){.${className}{opacity:0.5;}}}`,
      expect.stringContaining('@media (prefers-color-scheme: dark)'),
    ])
  })

  it('matches the nearest provider on React Native', () => {
    const binding = createNativeStyle(theme)
    const { View, calls } = createStandIn()
    const Conditional = createConditional(
      binding as unknown as ReturnType<typeof createWebStyle<typeof theme>>,
      View
    )
    const { ThemeProvider } = binding
    render(
      <>
        <Conditional />
        <ThemeProvider theme={darkTheme} colorScheme="dark">
          <Conditional />
        </ThemeProvider>
      </>
    )
    expect(calls.map((call) => call.style)).toEqual([
      [{ padding: 8 }],
      [{ padding: 4, opacity: 0.5 }],
    ])
  })
})
