// `css()` of `umber-style/react`: one style made once and passed around, on both platforms. `pnpm
// typecheck` compiles this file with and without the `react-native` export condition, and both must pass.
import { render } from '@testing-library/react'
import { isSheetEntry } from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import { apply, css, styled, type SharedEntry } from 'umber-style/react'
import * as native from './react-native'

/** What `css` throws for a function, as an argument or as an interpolation: the message of every binding. */
const FUNCTION_ERROR = new TypeError(
  "css(): a function is not a style here, as an argument or as an interpolation: css() makes a class with no component, so it has no props or theme to call it with. For a value of the props, use a styled component's style function; for a value of the theme, give an entry of StyleSheet.create((theme) => ...) to the style prop."
)

const Host = (props: { id?: string; className?: string }) => (
  <i id={props.id} className={props.className} />
)

describe('css of a style written for web and mobile', () => {
  it('gives an entry that goes in the style prop of a styled component and in apply', () => {
    const card = css({ padding: 8 }, [false, { web: { display: 'grid' } }])
    expectTypeOf(card).toEqualTypeOf<SharedEntry>()
    const Box = styled(Host)({ opacity: 1 })
    const { container } = render(<Box id="box" style={[card, css(card, { margin: 0 })]} />)
    expect(isSheetEntry(card)).toBe(true)
    expect(container.querySelector('#box')?.className).toMatch(/ /)
    expect(apply(card).className).toBe(String(card))
    // @ts-expect-error a value that is not valid on both platforms
    css({ display: 'grid' })
  })

  it('takes a tagged template, and is the merged native style on React Native', () => {
    const card = css`
      padding: 8px;
    `
    expect(isSheetEntry(card)).toBe(true)
    expect(native.css`padding: 8px;`).toEqual({ padding: 8 })
    expect(native.css({ padding: 8 }, { margin: 2 })).toEqual({ padding: 8, margin: 2 })
  })

  it('throws one error on both platforms for a function, given to it or in its template', () => {
    const byProps = (() => ({ padding: 8 })) as never
    // The value of the default style is made at its first use, so the error comes when it is read.
    expect(() => String(css(byProps))).toThrow(FUNCTION_ERROR)
    expect(() =>
      String(css`
        padding: ${byProps};
      `)
    ).toThrow(FUNCTION_ERROR)
    expect(() => ({ ...native.css(byProps) })).toThrow(FUNCTION_ERROR)
    expect(() => ({ ...native.css`padding: ${byProps};` })).toThrow(FUNCTION_ERROR)
  })
})
