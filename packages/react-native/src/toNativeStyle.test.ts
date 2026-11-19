import { toNativeStyle } from './toNativeStyle'

describe('toNativeStyle', () => {
  it('drops the label and every nested object, whole', () => {
    expect(
      toNativeStyle({
        label: 'button-root',
        color: '#fff',
        padding: 8,
        '&:hover': { color: 'red', '&:focus': { color: 'blue' } },
        '@media (min-width: 40em)': { padding: 16 },
      })
    ).toEqual({ color: '#fff', padding: 8 })
  })

  it('keeps arrays, null, undefined and false', () => {
    const style = { fontFamily: ['a', 'b'], a: null, b: undefined, c: false }
    expect(toNativeStyle(style)).toEqual(style)
  })
})
