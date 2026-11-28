// The type tests of `SheetStyleProp` and of handles in `umber-style/react`: one component file for web and
// mobile types its `style` as sheet entries only. `pnpm typecheck` compiles this file with and without the
// `react-native` export condition, and both must pass.
import { expectTypeOf } from 'vitest'
import {
  css,
  StyleSheet,
  styled,
  useStyle,
  type SharedEntry,
  type SheetStyleProp,
  type ThemedEntry,
} from 'umber-style/react'

const Host = (props: { id?: string }) => <i id={props.id} />

describe('SheetStyleProp in a style written for web and mobile', () => {
  it('takes entries, handles, css() values, falsy values and nested lists, and is the style of a styled component', () => {
    const object = StyleSheet.create({ box: { padding: 8 } })
    const themed = StyleSheet.create(() => ({ card: { padding: 4 } }))
    expectTypeOf(themed.card).toEqualTypeOf<ThemedEntry>()
    const useEntry = () => useStyle(themed).card
    expectTypeOf<ReturnType<typeof useEntry>>().toEqualTypeOf<SharedEntry>()
    const accepted: SheetStyleProp[] = [
      object.box,
      themed.card,
      [false, [null, themed.card]],
      undefined,
      css({ padding: 1 }),
    ]
    const Part = styled(Host)({ opacity: 1 })
    expect(<Part style={accepted} />).toBeDefined()
    expect(<Part style={themed.card} />).toBeDefined()
  })

  it('rejects a plain style object, a string, and a name the sheet does not have', () => {
    const themed = StyleSheet.create(() => ({ card: { padding: 4 } }))
    // @ts-expect-error a plain object
    const plain: SheetStyleProp = { padding: 8 }
    // @ts-expect-error a string
    const text: SheetStyleProp = 'x'
    // @ts-expect-error a name that the sheet does not have
    expect(themed.missing).toBeDefined()
    expect([plain, text]).toBeDefined()
  })
})
