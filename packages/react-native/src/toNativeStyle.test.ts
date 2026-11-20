import { toNativeStyle } from './toNativeStyle'

describe('toNativeStyle', () => {
  it('drops the label, selectors and at-rules, whole', () => {
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

  it('drops custom properties and a selector without a nested object', () => {
    expect(
      toNativeStyle({ '--accent': '#1b5fd1', ':hover': 1, 'a &': 2, '@supports': 3, padding: 8 })
    ).toEqual({ padding: 8 })
  })

  it('drops the animation and transition properties, also in the native part, and keeps transform', () => {
    expect(
      toNativeStyle({
        animation: 'pulse-1x 1s infinite',
        animationName: 'pulse-1x',
        animationDuration: 300,
        transition: 'opacity 200ms',
        transitionProperty: 'opacity',
        transitionDelay: 100,
        transform: [{ scale: 2 }],
        opacity: 1,
        native: { animationTimingFunction: 'linear', transitionDuration: 5, elevation: 1 },
      })
    ).toEqual({ transform: [{ scale: 2 }], opacity: 1, elevation: 1 })
  })

  it('keeps the object-valued properties of the platform', () => {
    const style = {
      shadowOffset: { width: 0, height: 2 },
      textShadowOffset: { width: 1, height: 1 },
      transform: [{ rotate: '45deg' }, { translateX: 4 }],
    }
    expect(toNativeStyle(style)).toEqual(style)
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
