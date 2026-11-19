// The type tests of `umber-style/react`: `pnpm typecheck` compiles this file twice, with and without the
// `react-native` export condition (tsconfig.json and tsconfig.native.json), and both must pass.
import { render } from '@testing-library/react'
import type { WebProperties } from '@umber-style/core'
import type { NativeStyleObject } from '@umber-style/react-native'
import type { ReactNode } from 'react'
import { expectTypeOf } from 'vitest'
import {
  add,
  apply,
  createStyle,
  divide,
  multiply,
  negate,
  StyleSheet,
  styled,
  subtract,
  useStyle,
  type SharedEntry,
  type SharedStyled,
  type SharedStyleObject,
  type Theme,
} from 'umber-style/react'

interface HostProps {
  id?: string
  children?: ReactNode
}
const Host = ({ id, children }: HostProps) => <i id={id}>{children}</i>

describe('what a style written for web and mobile accepts', () => {
  it('accepts the keys and values that both platforms have', () => {
    const Box = styled(Host)({
      padding: 8,
      margin: '50%',
      width: 'auto',
      display: 'flex',
      opacity: 0.5,
      backgroundColor: '#ffffff',
      borderRadius: 4,
      flexDirection: 'row',
    })
    render(<Box id="plain" />)
  })

  it('accepts a web part and a native part, each with the keys of its own platform', () => {
    const Box = styled(Host)({
      padding: 8,
      web: {
        '&:hover': { opacity: 0.8 },
        '@media (min-width: 40em)': { padding: 16 },
        display: 'grid',
      },
      native: {
        elevation: 2,
        shadowOffset: { width: 1, height: 2 },
        transform: [{ rotate: '45deg' }],
      },
    })
    render(<Box id="parts" />)
  })

  it('does not accept a key of one platform at the top level', () => {
    styled(Host)({
      // @ts-expect-error a nested selector is web only: put it in `web`
      '&:hover': { opacity: 0.8 },
    })
    styled(Host)({
      // @ts-expect-error `elevation` is native only: put it in `native`
      elevation: 2,
    })
    styled(Host)({
      // @ts-expect-error `float` is web only: put it in `web`
      float: 'left',
    })
    styled(Host)({
      // @ts-expect-error `label` is web only
      label: 'box',
    })
    styled(Host)({
      // @ts-expect-error a misspelt property
      backgroudColor: 'red',
    })
  })

  it('does not accept a value that one platform lacks', () => {
    styled(Host)({
      // @ts-expect-error `grid` is web only
      display: 'grid',
    })
    styled(Host)({
      // @ts-expect-error a keyword that React Native lacks: it takes 'flex', 'none' and 'contents'
      display: 'inline-block',
    })
  })

  it('cannot tell a length with a unit from a length: the platform types any string there', () => {
    // The platform types a dimension as number | string | 'auto', so '10px' compiles. React Native warns
    // about it in development instead.
    styled(Host)({ padding: '10px' })
    expectTypeOf<SharedStyleObject['padding']>().toBeNullable()
  })

  it('does not accept a key of the other platform inside a part', () => {
    styled(Host)({
      web: {
        // @ts-expect-error `elevation` is native only
        elevation: 2,
      },
    })
    styled(Host)({
      native: {
        // @ts-expect-error a nested selector is web only
        '&:hover': { opacity: 0.8 },
      },
    })
    styled(Host)({
      native: {
        // @ts-expect-error `float` is web only
        float: 'left',
      },
    })
    styled(Host)({
      native: {
        // @ts-expect-error `grid` is web only
        display: 'grid',
      },
    })
  })

  it('does not take the names of the parts from a property of either platform', () => {
    expectTypeOf<
      Extract<'web' | 'native', keyof WebProperties | keyof NativeStyleObject>
    >().toBeNever()
  })

  it('takes a style function that returns a shared style, and the props', () => {
    const Box = styled(Host)<{ isWide?: boolean }>(({ isWide }) => ({
      padding: isWide ? 16 : 8,
      web: { '&:hover': { opacity: 0.8 } },
    }))
    expectTypeOf<Parameters<typeof Box>[0]['isWide']>().toEqualTypeOf<boolean | undefined>()
  })

  it('types sheets, useStyle, the style prop and apply', () => {
    const sheet = StyleSheet.create({
      container: { padding: 8, native: { elevation: 1 } },
      active: { opacity: 1 },
    })
    // @ts-expect-error a misspelt property in a sheet
    StyleSheet.create({ box: { backgroudColor: 'red' } })
    // @ts-expect-error `display: grid` in a sheet
    StyleSheet.create({ box: { display: 'grid' } })
    StyleSheet.create(() => ({ box: { padding: 4 } }))

    const Box = styled(Host)()
    const Panel = () => {
      const styles = useStyle(sheet)
      expectTypeOf(styles.container).toEqualTypeOf<SharedEntry>()
      return (
        <Box
          id="panel"
          style={[styles.container, false, { opacity: 0.9 }]}
          {...apply(styles.active)}
        />
      )
    }
    // @ts-expect-error a style prop is checked like a style
    ;<Box style={{ display: 'grid' }} />
    expectTypeOf(Panel).toBeFunction()
  })

  it('has one source type for both resolutions', () => {
    expectTypeOf(styled).toEqualTypeOf<SharedStyled<Theme>>()
    const own = createStyle({ palette: { primary: '#0000ff' } })
    own.styled(Host)(({ theme }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      return { padding: 4 }
    })
    expectTypeOf<SharedStyleObject['padding']>().not.toBeAny()
  })
})

describe('the arithmetic helpers in a shared style', () => {
  it('are accepted as values, a negative margin included', () => {
    const own = createStyle({ space: [0, 4, 8] })
    const Box = own.styled(Host)(({ theme }) => ({
      marginLeft: negate(theme.space[2]),
      padding: multiply(theme.space[1], 2),
      gap: divide(theme.space[2], 2),
      height: subtract(theme.space[2], 2),
      width: add('50%', '10%'),
      top: negate('5%'),
      web: { margin: negate(theme.space[1]) },
      native: { margin: negate(theme.space[1]) },
    }))
    expectTypeOf(negate(8)).toEqualTypeOf<number>()
    expectTypeOf(add(1, 2)).toEqualTypeOf<number>()
    expectTypeOf(multiply('50%', 2)).toEqualTypeOf<number | `${number}%`>()
    expectTypeOf(Box).toBeFunction()
  })

  it('do not take a value that only the web computes', () => {
    // @ts-expect-error a reference string cannot be computed on React Native
    multiply('var(--space-2)', 2)
    // @ts-expect-error a length with a unit is not a percentage
    add('8px', 4)
  })
})
