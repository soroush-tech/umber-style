import isPropValid, { isPropValid as namedIsPropValid } from './react-native'

/** The names of `names` that the entry answers `expected` for: `[]` when it agrees on every one. */
function findOther(names: string[], expected: boolean) {
  return names.filter((name) => isPropValid(name) !== expected)
}

describe('isPropValid of the React Native entry', () => {
  it('is true for the props of the built-in components', () => {
    expect(
      findOther(
        [
          'testID',
          'nativeID',
          'style',
          'children',
          'ref',
          'key',
          'hitSlop',
          'pointerEvents',
          'numberOfLines',
          'source',
          'resizeMode',
          'keyboardType',
          'contentContainerStyle',
          'renderItem',
          'ListHeaderComponent',
          'android_ripple',
          'ios_backgroundColor',
          'animationType',
          'barStyle',
          'thumbColor',
          'tabIndex',
          'id',
        ],
        true
      )
    ).toEqual([])
  })

  it('is true for aria-, for accessibility and an upper-case letter, and for a handler', () => {
    expect(
      findOther(
        [
          'aria-label',
          'aria-hidden',
          'accessibilityLabel',
          'accessibilityRole',
          'onPress',
          'onLayout',
          'onChangeText',
        ],
        true
      )
    ).toEqual([])
  })

  it('is false for as, theme, the props of a component and the attributes of the web', () => {
    expect(
      findOther(
        [
          'as',
          'theme',
          'variant',
          'isActive',
          'bg',
          'p',
          'mt',
          'className',
          'htmlFor',
          'data-row',
          'dangerouslySetInnerHTML',
          'accessibility',
          'onpress',
        ],
        false
      )
    ).toEqual([])
  })

  it('is true for color, size, width and height: ActivityIndicator, Button and Image take them', () => {
    expect(findOther(['color', 'size', 'width', 'height'], true)).toEqual([])
  })

  it('is the named export too', () => {
    expect(namedIsPropValid).toBe(isPropValid)
  })
})
