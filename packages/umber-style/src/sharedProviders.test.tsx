// The type tests of the providers in `umber-style/react`: `pnpm typecheck` compiles this file with and
// without the `react-native` export condition (tsconfig.json and tsconfig.native.json), so one source of
// a nested provider with portal content compiles for both. The server build has none of these names
// (no context, no portal), so tsconfig.server.json leaves this file out.
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expectTypeOf } from 'vitest'
import { createCache, createMemorySheet } from 'umber-style'
import {
  CacheProvider,
  createStyle,
  ThemeContext,
  ThemeScope,
  useThemeClass,
} from 'umber-style/react'

interface HostProps {
  id?: string
  children?: ReactNode
}
const Host = ({ id, children }: HostProps) => <i id={id}>{children}</i>

describe('the providers in shared code', () => {
  it('types a function theme, a nested provider, ThemeScope, useThemeClass and ThemeContext', () => {
    const own = createStyle({ palette: { text: '#111111' } })
    function Scoped() {
      const className = own.useThemeClass()
      expectTypeOf(className).toEqualTypeOf<string | undefined>()
      return (
        <own.ThemeScope>
          <own.ThemeContext.Consumer>
            {(theme) => <Host id={theme?.palette.text ?? className} />}
          </own.ThemeContext.Consumer>
        </own.ThemeScope>
      )
    }
    render(
      <own.ThemeProvider theme={{ palette: { text: '#222222' } }}>
        <own.ThemeProvider theme={(outer) => ({ palette: { text: outer.palette.text } })}>
          <Scoped />
        </own.ThemeProvider>
      </own.ThemeProvider>
    )
    expectTypeOf(ThemeScope).toBeFunction()
    expectTypeOf(useThemeClass).returns.toEqualTypeOf<string | undefined>()
    expectTypeOf(ThemeContext).not.toBeAny()
  })

  it('types a CacheProvider around shared code', () => {
    const own = createStyle({ palette: { text: '#111111' } })
    const Text = own.styled(Host)({ padding: 4 })
    const cache = createCache({ prefix: 'shared', sheet: createMemorySheet() })
    const { container } = render(
      <CacheProvider value={cache}>
        <Text id="text" />
      </CacheProvider>
    )
    expect(container.querySelector('#text')).not.toBeNull()
  })
})
