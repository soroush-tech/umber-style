import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { createCache, createMemorySheet } from './index'
import { createStyle as createWebStyle } from './react'
import { createStyle as createNativeStyle } from './react-native'
import type { SharedStyle } from './shared'

const theme = { palette: { primary: '#0000ff' } }

/** One shared source: a styled component and a sheet, with a `web` part and a `native` part. */
function createComponents(binding: SharedStyle<typeof theme>, Host: 'div' | (() => null)) {
  const { styled, StyleSheet, useStyle } = binding
  const Box = styled(Host as never)({
    padding: 8,
    web: { '&:hover': { opacity: 0.8 }, color: 'red' },
    native: { elevation: 2 },
  })
  const sheet = StyleSheet.create({
    card: { margin: 4, web: { cursor: 'pointer' }, native: { elevation: 3 } },
  })
  function Card() {
    const styles = useStyle(sheet)
    return <Box style={styles.card}>card</Box>
  }
  return { Card }
}

describe('the web part and the native part of a shared style', () => {
  it('on the web merges the web part over the rest and drops the native part', () => {
    const memory = createMemorySheet()
    const binding = createWebStyle(theme, {
      prefix: 'p',
      cache: createCache({ prefix: 'p', sheet: memory }),
    })
    const { Card } = createComponents(binding as unknown as SharedStyle<typeof theme>, 'div')
    render(<Card />)
    // The Box styles are one class (components), the entry of the card another (overrides).
    const [own, given, ...rest] = screen.getByText('card').className.split(' ')
    expect(rest).toEqual([])
    const rules = memory.rules.filter((rule) => rule.includes('.p-'))
    // The first rule is the class of the sheet entry itself (components); the override merges it.
    expect(rules.slice(1)).toEqual([
      `@layer p-components{.${own}{padding:8px;color:red;}}`,
      `@layer p-components{.${own}:hover{opacity:0.8;}}`,
      `@layer p-overrides{.${given}{margin:4px;cursor:pointer;}}`,
    ])
    expect(rules.join('')).not.toContain('elevation')
  })

  it('on React Native merges the native part over the rest and drops the web part', () => {
    const calls: Record<string, unknown>[] = []
    const Host = (props: Record<string, unknown>) => {
      calls.push(props)
      return createElement('view')
    }
    const binding = createNativeStyle(theme)
    const { Card } = createComponents(
      binding as unknown as SharedStyle<typeof theme>,
      Host as never
    )
    render(<Card />)
    expect(calls[0].style).toEqual([
      { padding: 8, elevation: 2 },
      { margin: 4, elevation: 3 },
    ])
  })
})
