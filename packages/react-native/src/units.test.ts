// The type tests of the converted keys: `pnpm typecheck` compiles this file.
import { expectTypeOf } from 'vitest'
import type { NativeMotionStyle, NativeStyleObject } from './nativeStyle'
import { convertValues, LENGTH_KEYS, NUMBER_KEYS, readNumber, toLength } from './units'

/** The keys of the platform's own style types: a native style without the animation and transition keys. */
type PlatformStyle = Omit<NativeStyleObject, keyof NativeMotionStyle>

type Value<K extends keyof PlatformStyle> = NonNullable<PlatformStyle[K]>

/** The keys of a native style whose value type takes any number and is not a colour (a colour has a symbol member). */
type NumericKey = {
  [K in keyof PlatformStyle]-?: number extends Value<K>
    ? [Extract<Value<K>, symbol>] extends [never]
      ? K
      : never
    : never
}[keyof PlatformStyle]

/** `style` with its lengths and numbers converted, as `toNativeStyle` does. */
function converted(style: Record<string, unknown>, remBase = 16) {
  const copy = { ...style }
  convertValues(copy, remBase)
  return copy
}

describe('the keys that are converted', () => {
  it('are exactly the keys of the platform types that take a number and are not colours', () => {
    expectTypeOf<
      (typeof LENGTH_KEYS)[number] | (typeof NUMBER_KEYS)[number]
    >().toEqualTypeOf<NumericKey>()
    expect(new Set([...LENGTH_KEYS, ...NUMBER_KEYS]).size).toBe(
      LENGTH_KEYS.length + NUMBER_KEYS.length
    )
  })
})

describe('readNumber and toLength', () => {
  it('read a number with px, rem, a percentage or no unit, in any case and with white space around', () => {
    expect(readNumber('8')).toEqual({ value: 8, unit: '' })
    expect(readNumber(' -1.5PX ')).toEqual({ value: -1.5, unit: 'px' })
    expect(readNumber('.5rem')).toEqual({ value: 0.5, unit: 'rem' })
    expect(readNumber('3.')).toEqual({ value: 3, unit: '' })
    expect(readNumber('50%')).toEqual({ value: 50, unit: '%' })
    for (const text of ['1em', '8 px', '+8px', '1.2.3', 'px', '', 'auto', 'calc(8px)']) {
      expect(readNumber(text)).toBeUndefined()
    }
  })

  it('give a length in px, rem or no unit as a number, and nothing for a percentage', () => {
    expect(toLength('8px', 16)).toBe(8)
    expect(toLength('0', 16)).toBe(0)
    expect(toLength('1.5rem', 16)).toBe(24)
    expect(toLength('2rem', 10)).toBe(20)
    expect(toLength('50%', 16)).toBeUndefined()
    expect(toLength('1em', 16)).toBeUndefined()
  })
})

describe('convertValues', () => {
  it('turns lengths into numbers: px, rem, and numeric strings, negative and decimal', () => {
    expect(
      converted({
        padding: '8px',
        margin: '-8px',
        width: '1.5px',
        height: '0',
        gap: '8',
        top: '-8',
        borderRadius: '1.5',
        fontSize: '1rem',
        lineHeight: '1.5rem',
        borderWidth: '1px',
        elevation: '2',
      })
    ).toEqual({
      padding: 8,
      margin: -8,
      width: 1.5,
      height: 0,
      gap: 8,
      top: -8,
      borderRadius: 1.5,
      fontSize: 16,
      lineHeight: 24,
      borderWidth: 1,
      elevation: 2,
    })
  })

  it('multiplies rem by the base it is given', () => {
    expect(converted({ fontSize: '1rem', padding: '0.5rem' }, 10)).toEqual({
      fontSize: 10,
      padding: 5,
    })
  })

  it('turns a numeric string into a number for a key that is a number, and leaves a unit there', () => {
    expect(
      converted({ opacity: '0.5', zIndex: '10', flex: '1', aspectRatio: '1.5', flexGrow: '2px' })
    ).toEqual({ opacity: 0.5, zIndex: 10, flex: 1, aspectRatio: 1.5, flexGrow: '2px' })
  })

  it('keeps a percentage, auto, a ratio, and what it cannot read', () => {
    const style = {
      width: '50%',
      height: 'auto',
      aspectRatio: '16 / 9',
      margin: '1em',
      top: '100vh',
      left: 'calc(100% - 8px)',
      padding: '8px 16px',
    }
    expect(converted(style)).toEqual(style)
  })

  it('keeps the strings of keys whose text means something, and every value that is not a string', () => {
    const style = {
      fontWeight: '700',
      fontFamily: '12',
      color: '0',
      backgroundColor: '#fff',
      fontVariant: 'small-caps',
      transform: 'translateX(8px)',
      boxShadow: '0 0 4px red',
      unknownKey: '8px',
      padding: 8,
      shadowOffset: { width: '1px', height: 2 },
      margin: null,
    }
    expect(converted(style)).toEqual(style)
  })
})
