// The type tests of the sheets of `umber-style/react`: an object sheet is its entries, a sheet made from a
// function of the theme is for `useStyle`. `pnpm typecheck` compiles this file with and without the
// `react-native` export condition, and both must pass.
import { expectTypeOf } from 'vitest'
import {
  apply,
  StyleSheet,
  styled,
  useStyle,
  type SharedEntry,
  type SharedStyleObject,
} from 'umber-style/react'

const Host = (props: { id?: string }) => <i id={props.id} />

describe('the sheets of a style written for web and mobile', () => {
  it('gives the entries for an object, usable at once, in a style prop and in apply', () => {
    const object = StyleSheet.create({ box: { padding: 8 }, text: { margin: 2 } })
    expectTypeOf(object).toEqualTypeOf<{ readonly box: SharedEntry; readonly text: SharedEntry }>()
    const Box = styled(Host)({ opacity: 1 })
    expect(<Box style={object.box} />).toBeDefined()
    expect(apply(object.text)).toBeDefined()
    // @ts-expect-error a key that the sheet does not have
    expect(object.missing).toBeUndefined()
    // @ts-expect-error a value that is not valid on both platforms
    StyleSheet.create({ box: { display: 'grid' } })
    const part: SharedStyleObject = { web: { display: 'grid' } }
    expect(StyleSheet.create({ box: part })).toBeDefined()
  })

  it('gives a sheet for useStyle for a function of the theme, which is not an entry and has none', () => {
    const themed = StyleSheet.create(() => ({ box: { padding: 8 } }))
    // @ts-expect-error a sheet that is not resolved has no entries
    expect(themed.box).toBeUndefined()
    // @ts-expect-error it is not an entry, so it is not given to apply
    expect(apply(themed)).toBeDefined()
    const Box = styled(Host)({ opacity: 1 })
    // @ts-expect-error it is not what the style prop takes
    expect(<Box style={themed} />).toBeDefined()
  })

  it('has useStyle take both and return the entries', () => {
    const object = StyleSheet.create({ box: { padding: 8 } })
    const themed = StyleSheet.create(() => ({ box: { padding: 8 } }))
    // Hooks: only their types are checked here, they are not called.
    const useReadObject = () => useStyle(object)
    const useReadThemed = () => useStyle(themed)
    expectTypeOf<ReturnType<typeof useReadObject>>().toEqualTypeOf<{ readonly box: SharedEntry }>()
    expectTypeOf<ReturnType<typeof useReadThemed>>().toEqualTypeOf<{ box: SharedEntry }>()
    // @ts-expect-error an entry alone is not a sheet
    const useReadEntry = () => useStyle(object.box)
    expect(useReadEntry).toBeDefined()
  })
})
