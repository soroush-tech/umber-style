import { act, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
// The stand-in of the platform, which the binding's own import of `react-native` resolves to here.
import { Pressable, pressable } from '../vitest.react-native'
import { at, createCache, createMemorySheet, state } from './index'
import { createStyle as createWebStyle, state as stateWeb } from './react'
import { createStyle as createNativeStyle, state as stateNative } from './react-native'

const theme = { palette: { primary: '#8a4b2a' } }

/** The one style source of a button: its pressed, hovered, focused and disabled looks are state keys. */
const buttonStyle = {
  opacity: 1,
  backgroundColor: theme.palette.primary,
  ...at(state('hovered'), { opacity: 0.9 }),
  ...at(state('pressed'), { opacity: 0.7 }),
  ...at(state('focused'), { borderWidth: 2 }),
  ...at(state('disabled'), { opacity: 0.4 }),
}

/** The one component source: it takes the binding it runs on, and its host component. */
function createButton(binding: ReturnType<typeof createWebStyle<typeof theme>>, Host: unknown) {
  return binding.styled(Host as never, { name: 'Button' })(buttonStyle) as unknown as (
    props: Record<string, unknown>
  ) => ReactNode
}

describe('one style source with state keys', () => {
  it('is the same key on every entry', () => {
    expect(stateWeb).toBe(state)
    expect(stateNative).toBe(state)
  })

  it('is the selectors an author writes on the web', () => {
    const sheet = createMemorySheet()
    const binding = createWebStyle(theme, {
      prefix: 'u',
      cache: createCache({ prefix: 'u', sheet }),
    })
    const Button = createButton(binding, 'button')
    render(<Button>web</Button>)
    const name = screen.getByText('web').className
    expect(sheet.rules.filter((rule) => rule.includes(`.${name}`))).toEqual([
      `@layer u-components{.${name}{opacity:1;background-color:#8a4b2a;}}`,
      `@layer u-components{.${name}:hover{opacity:0.9;}}`,
      `@layer u-components{.${name}:active{opacity:0.7;}}`,
      `@layer u-components{.${name}:focus-visible{border-width:2px;}}`,
      `@layer u-components{.${name}:disabled,.${name}[aria-disabled="true"]{opacity:0.4;}}`,
    ])
  })

  it('is the state of a Pressable and the props of another component on React Native', () => {
    const binding = createNativeStyle(theme) as unknown as ReturnType<
      typeof createWebStyle<typeof theme>
    >
    const Button = createButton(binding, Pressable)
    render(<Button />)
    expect(pressable.style).toEqual([{ opacity: 1, backgroundColor: '#8a4b2a' }])
    act(() => pressable.press(true))
    expect(pressable.style).toEqual([{ opacity: 0.7, backgroundColor: '#8a4b2a' }])
    act(() => pressable.press(false))
    render(<Button disabled />)
    act(() => pressable.press(true))
    expect(pressable.style).toEqual([{ opacity: 0.4, backgroundColor: '#8a4b2a' }])

    const calls: Record<string, unknown>[] = []
    const View = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view')
    }
    const Card = createButton(binding, View)
    render(<Card pressed />)
    expect(calls[0].style).toEqual([{ opacity: 0.7, backgroundColor: '#8a4b2a' }])
    expect(calls[0]).not.toHaveProperty('pressed')
  })
})
