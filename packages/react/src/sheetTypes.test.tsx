import { createStyle } from './createStyle'
import type { SheetEntry, ThemedEntry } from './types'

const { styled, StyleSheet, apply, useStyle } = createStyle({ palette: { primary: '#0000ff' } })
const Box = styled('div')({ color: 'red' })

describe('the types of an object sheet and of a sheet made from a function', () => {
  it('gives the entries for an object, usable at once', () => {
    const sheet = StyleSheet.create({ box: { color: 'red' }, text: { margin: 1 } })
    expectTypeOf(sheet.box).toEqualTypeOf<SheetEntry>()
    expectTypeOf(sheet).toEqualTypeOf<{ readonly box: SheetEntry; readonly text: SheetEntry }>()
    expectTypeOf(apply(sheet.box)).toEqualTypeOf<{ className?: string }>()
    const element = <Box style={sheet.text} />
    expect(element).toBeDefined()
    // @ts-expect-error a key that the sheet does not have
    expect(sheet.missing).toBeUndefined()
    // @ts-expect-error a misspelt property in an object sheet
    StyleSheet.create({ box: { backgroudColor: 'red' } })
  })

  it('gives a sheet for useStyle for a function of the theme, which is not an entry and has none', () => {
    const sheet = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    // Each name is a handle, which the style prop of a styled component resolves with its theme.
    expectTypeOf(sheet.box).toEqualTypeOf<ThemedEntry>()
    // @ts-expect-error it is not an entry, so it is not given to apply
    expect(apply(sheet)).toBeDefined()
    // @ts-expect-error it is not what the style prop takes
    expect(<Box style={sheet} />).toBeDefined()
    expect(typeof useStyle).toBe('function')
  })

  it('has useStyle take both and return the entries', () => {
    const object = StyleSheet.create({ box: { color: 'red' } })
    const themed = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    // Hooks: only their types are checked here, they are not called.
    const useReadObject = () => useStyle(object)
    const useReadThemed = () => useStyle(themed)
    expectTypeOf<ReturnType<typeof useReadObject>>().toEqualTypeOf<{ readonly box: SheetEntry }>()
    expectTypeOf<ReturnType<typeof useReadThemed>>().toEqualTypeOf<{ box: SheetEntry }>()
    // @ts-expect-error an entry alone is not a sheet
    const useReadEntry = () => useStyle(object.box)
    expect(useReadEntry).toBeDefined()
  })
})
