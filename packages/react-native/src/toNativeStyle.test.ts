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

describe('the platform parts of a style written for both platforms', () => {
  it('merges the native part over the rest and drops the web part', () => {
    expect(
      toNativeStyle({
        padding: 8,
        elevation: 1,
        web: { '&:hover': { opacity: 0.8 } },
        native: { elevation: 2, margin: 4 },
      })
    ).toEqual({ padding: 8, elevation: 2, margin: 4 })
  })

  it('drops a part that is not an object', () => {
    expect(toNativeStyle({ padding: 8, native: undefined, web: false })).toEqual({ padding: 8 })
    expect(toNativeStyle({ padding: 8, native: {} })).toEqual({ padding: 8 })
  })
})
