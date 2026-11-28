// The type tests of the native style: `pnpm typecheck` compiles this file.
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { expectTypeOf } from 'vitest'
import { add, divide, multiply, negate, subtract } from './calc'
import { createStyle } from './createStyle'
import type { NativeSheetEntry, NativeStyleObject } from './nativeStyle'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

/** A stand-in for a native component: it records the props it gets. */
function createStandIn() {
  const calls: Record<string, unknown>[] = []
  const View = (props: { id?: string; style?: unknown }) => {
    calls.push(props)
    return createElement('view')
  }
  return { View, calls }
}

describe('what a native style accepts', () => {
  it('accepts the keys of the view, text and image styles with their value types', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)({
      padding: 8,
      margin: '50%',
      display: 'flex',
      elevation: 2,
      shadowOffset: { width: 1, height: 2 },
      shadowColor: '#000000',
      transform: [{ rotate: '45deg' }, { translateX: 4 }],
      fontSize: 14,
      fontWeight: '600',
      tintColor: '#ff0000',
      resizeMode: 'cover',
      flexDirection: 'row',
      borderRadius: 4,
    })
    render(<Box id="a" />)
    expect(calls[0].id).toBe('a')
  })

  it('has no any in it', () => {
    expectTypeOf<NativeStyleObject['padding']>().not.toBeAny()
    expectTypeOf<NativeStyleObject['shadowOffset']>().not.toBeAny()
    expectTypeOf<NativeStyleObject['transform']>().not.toBeAny()
  })

  it('rejects a nested selector, an at-rule, a custom property and the label', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn()
    const rejected = [
      // @ts-expect-error a nested selector does not exist on React Native
      styled(View)({ '&:hover': { opacity: 0.8 } }),
      // @ts-expect-error an at-rule does not exist on React Native
      styled(View)({ '@media (min-width: 40em)': { padding: 8 } }),
      // @ts-expect-error a custom property does not exist on React Native
      styled(View)({ '--x': 1 }),
      // @ts-expect-error the label is for the web
      styled(View)({ label: 'box' }),
    ]
    expectTypeOf(rejected).items.toBeFunction()
  })

  it('rejects a value the platform lacks and a misspelt property', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn()
    const rejected = [
      // @ts-expect-error React Native has no grid
      styled(View)({ display: 'grid' }),
      // @ts-expect-error `backgroudColor` is not a property
      styled(View)({ backgroudColor: 'red' }),
      // @ts-expect-error a web-only property
      styled(View)({ float: 'left' }),
      // @ts-expect-error a misspelt property next to valid ones
      styled(View)({ padding: 8, paddng: 8 }),
    ]
    expectTypeOf(rejected).items.toBeFunction()
  })

  it('takes a style function with the props and the theme', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn()
    const Box = styled(View)<{ isWide?: boolean }>(({ isWide, theme: values }) => {
      expectTypeOf(isWide).toEqualTypeOf<boolean | undefined>()
      expectTypeOf(values.space).toEqualTypeOf<number[]>()
      return { padding: isWide ? 16 : values.space[1], elevation: 1 }
    })
    expectTypeOf(Box).toBeFunction()
  })

  it('does not catch what a variable holds, or a literal that a style function returns', () => {
    const { styled } = createStyle(theme)
    const { View } = createStandIn()
    const widened = { padding: 8, paddng: 8 }
    const accepted = [styled(View)(widened), styled(View)(() => ({ padding: 8, paddng: 8 }))]
    // Nothing is nested here, so a style with no valid key at all is caught as a weak type.
    const onlyTypo = { paddng: 8 }
    const rejected = [
      // @ts-expect-error no property in common with a native style
      styled(View)(onlyTypo),
      // @ts-expect-error a function that returns no valid key
      styled(View)(() => ({ paddng: 8 })),
      // @ts-expect-error a typed return is checked
      styled(View)((): NativeStyleObject => ({ paddng: 8 })),
    ]
    expectTypeOf(accepted).items.toBeFunction()
    expectTypeOf(rejected).items.toBeFunction()
  })

  it('checks a sheet, useStyle, the style prop and apply', () => {
    const { StyleSheet, styled, useStyle, apply } = createStyle(theme)
    const { View } = createStandIn()
    const sheet = StyleSheet.create({ box: { padding: 8, elevation: 2 }, active: { opacity: 1 } })
    StyleSheet.create((values) => ({ box: { padding: values.space[2] } }))
    // @ts-expect-error a nested selector in a sheet
    StyleSheet.create({ box: { '&:hover': { opacity: 1 } } })
    // @ts-expect-error `grid` in a sheet
    StyleSheet.create({ box: { display: 'grid' } })
    // @ts-expect-error a misspelt property in a sheet
    StyleSheet.create({ box: { paddng: 1 } })
    expectTypeOf(StyleSheet.hairlineWidth).toBeNumber()

    const Box = styled(View)()
    const Panel = () => {
      const styles = useStyle(sheet)
      expectTypeOf(styles.box).toEqualTypeOf<NativeSheetEntry>()
      expectTypeOf(apply(styles.active).style).toEqualTypeOf<NativeStyleObject[]>()
      return <Box style={[styles.box, false, { opacity: 0.9 }]} />
    }
    // @ts-expect-error a nested selector in the style prop
    ;<Box style={{ '&:hover': { opacity: 1 } }} />
    // @ts-expect-error `grid` in the style prop
    ;<Box style={[{ display: 'grid' }]} />
    // @ts-expect-error a nested selector in apply
    apply({ '&:hover': { opacity: 1 } })
    expectTypeOf(Panel).toBeFunction()
  })
})

describe('the arithmetic helpers in a native style', () => {
  it('are accepted as values, a negative margin included', () => {
    const { styled } = createStyle(theme)
    const { View, calls } = createStandIn()
    const Box = styled(View)(({ theme: refs }) => ({
      marginLeft: negate(refs.space[2]),
      padding: multiply(refs.space[1], 2),
      width: add('50%', '10%'),
      height: subtract(8, 2),
      top: negate('5%'),
      margin: divide(refs.space[2], 2),
    }))
    render(<Box id="calc" />)
    expect(calls[0].style).toEqual([
      { marginLeft: -8, padding: 8, width: '60%', height: 6, top: '-5%', margin: 4 },
    ])
  })
})
