// `css()` of `umber-style/react`: one style made once and passed around, on both platforms. `pnpm
// typecheck` compiles this file with and without the `react-native` export condition, and both must pass.
import { render } from '@testing-library/react'
import { isSheetEntry } from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import { apply, css, styled, type SharedEntry } from 'umber-style/react'
import * as native from './react-native'

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
})
