// The type tests of `when()`, `whenScheme()` and `state()` in a style written for web and mobile:
// `pnpm typecheck` compiles this file with and without the `react-native` export condition.
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expectTypeOf } from 'vitest'
import { at, createStyle, state, styled } from 'umber-style/react'

interface HostProps {
  id?: string
  children?: ReactNode
}
const Host = ({ id, children }: HostProps) => <i id={id}>{children}</i>

describe('what the condition keys accept in a style written for web and mobile', () => {
  it('accepts when() and whenScheme() at the top level and inside the parts', () => {
    const { when, whenScheme } = createStyle({ palette: { primary: '#0000ff' } })
    const dark = { palette: { primary: '#8888ff' } }
    const Box = styled(Host)({
      padding: 8,
      [when(dark)]: { padding: 4 },
      [whenScheme('dark')]: { opacity: 0.5 },
      web: { ...at(when(dark), { '&:hover': { opacity: 0.8 } }) },
      native: { [whenScheme('light')]: { elevation: 2 } },
    })
    render(<Box id="conditions" />)
    expectTypeOf(when(dark)).toEqualTypeOf<`@theme ${string}`>()
    expectTypeOf(whenScheme('dark')).toEqualTypeOf<'@scheme dark' | '@scheme light'>()
  })

  it('still rejects a misspelt ordinary key next to a condition', () => {
    const { when } = createStyle({ palette: { primary: '#0000ff' } })
    const Box = styled(Host)({
      // @ts-expect-error a misspelt property
      paddng: 8,
      [when({})]: { padding: 4 },
    })
    expectTypeOf(Box).toBeFunction()
  })
})

describe('what the state keys accept in a style written for web and mobile', () => {
  it('accepts state() through at, alone or next to other keys, in a part and in a function style', () => {
    const Button = styled(Host)({ ...at(state('pressed'), { opacity: 0.7 }) })
    const Card = styled(Host)(
      {
        opacity: 1,
        ...at(state('disabled'), { opacity: 0.4 }),
        [state('hovered')]: { opacity: 0.9 },
      },
      () => ({ web: { ...at(state('focused'), { outlineWidth: 2 }) } })
    )
    render(
      <>
        <Button id="pressed" pressed />
        <Card id="states" hovered focused />
      </>
    )
    expectTypeOf(state('pressed')).toEqualTypeOf<`@state ${string}`>()
  })

  it('rejects a name that is not a state', () => {
    // @ts-expect-error not one of the four states
    expectTypeOf(state('active')).toBeString()
  })
})
