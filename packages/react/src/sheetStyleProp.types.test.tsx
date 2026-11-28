import { createStyle } from './createStyle'
import type { SheetEntry, SheetStyleProp, StyleProp, ThemedEntry } from './types'

const { styled, StyleSheet, apply, useStyle, css } = createStyle({
  palette: { primary: '#0000ff' },
})
const Box = styled('div')({ color: 'red' })

describe('the types of a handle of a sheet made from a function of the theme', () => {
  it('types sheet.key as a handle, for the style of a styled component and nowhere without a theme', () => {
    const sheet = StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    expectTypeOf(sheet.box).toEqualTypeOf<ThemedEntry>()
    expect(<Box style={sheet.box} />).toBeDefined()
    expect(<Box style={[sheet.box, false, null, undefined, { opacity: 1 }]} />).toBeDefined()
    expect(() => {
      // @ts-expect-error apply has no theme
      apply(sheet.box)
      // @ts-expect-error css has no theme
      css(sheet.box)
      // @ts-expect-error a plain element: its style is the platform's
      expect(<div style={sheet.box} />).toBeDefined()
    }).toThrow(TypeError)
    // @ts-expect-error a name that the sheet does not have
    expect(sheet.missing).toBeDefined()
    const useReadThemed = () => useStyle(sheet)
    expectTypeOf<ReturnType<typeof useReadThemed>>().toEqualTypeOf<{ box: SheetEntry }>()
    // @ts-expect-error a handle alone is not a sheet
    const useReadHandle = () => useStyle(sheet.box)
    expect(useReadHandle).toBeDefined()
  })
})

describe('SheetStyleProp', () => {
  it('takes entries, handles, css() values, falsy values and nested lists, and is a StyleProp', () => {
    const object = StyleSheet.create({ a: { color: 'red' } })
    const themed = StyleSheet.create((theme) => ({ b: { color: theme.palette.primary } }))
    const accepted: SheetStyleProp[] = [
      object.a,
      themed.b,
      [object.a, [themed.b, false]],
      null,
      undefined,
      false,
      css({ color: 'red' }),
    ]
    const asStyle: StyleProp = accepted
    expect(<Box style={accepted} />).toBeDefined()
    expect(asStyle).toBeDefined()
  })

  it('rejects a plain style object and a string', () => {
    // @ts-expect-error a plain object
    const plain: SheetStyleProp = { color: 'red' }
    // @ts-expect-error a plain object in a list
    const listed: SheetStyleProp = [{ color: 'red' }]
    // @ts-expect-error a string
    const text: SheetStyleProp = 'x'
    expect([plain, listed, text]).toBeDefined()
  })
})
