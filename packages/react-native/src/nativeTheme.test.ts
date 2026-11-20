// The type tests of the converted theme: `pnpm typecheck` compiles this file.
import { expectTypeOf } from 'vitest'
import { DEFAULT_LENGTH_KEYS, toNativeTheme, type NativeTheme } from './nativeTheme'

const convert = <T extends object>(theme: T) => toNativeTheme(theme, DEFAULT_LENGTH_KEYS, 16)

describe('toNativeTheme', () => {
  it('turns the lengths under the length keys into numbers, in arrays and objects at any depth', () => {
    expect(
      convert({
        space: ['0px', '4px', '8px', '0', '-2px', '1.5px', '.5rem'],
        sizes: { icon: { small: '16px', large: '2rem' }, full: '100%', fit: 'auto' },
        radii: { sm: '2px', md: 4 },
        fontSizes: ['12px', '1rem'],
        borderWidths: { thin: '1px' },
      })
    ).toEqual({
      space: [0, 4, 8, 0, -2, 1.5, 8],
      sizes: { icon: { small: 16, large: 32 }, full: '100%', fit: 'auto' },
      radii: { sm: 2, md: 4 },
      fontSizes: [12, 16],
      borderWidths: { thin: 1 },
    })
  })

  it('leaves the other keys alone: colours, line heights and breakpoints with their helpers', () => {
    const breakpoints = Object.defineProperty(['40em', '64em'], 'up', {
      value: (key: string) => `(min-width: ${key})`,
    })
    const palette = { primary: '#1b5fd1' }
    const lineHeights = { body: '1.5', tight: '20px' }
    const native = convert({ palette, lineHeights, breakpoints, space: ['8px'] })
    expect(native.breakpoints).toBe(breakpoints)
    expect(native.palette).toBe(palette)
    expect(native.lineHeights).toBe(lineHeights)
    expect(native.space).toEqual([8])
  })

  it('returns the theme itself, and each part itself, when there is nothing to convert', () => {
    const theme = { space: [0, 4, '50%'], radii: { round: '9999%' }, palette: { text: '#000' } }
    expect(convert(theme)).toBe(theme)
    const sizes = { icon: 16 }
    expect(convert({ space: ['8px'], sizes }).sizes).toBe(sizes)
  })

  it('keeps the other members of an array, a class instance, a function and a non-enumerable helper of the theme', () => {
    const space = Object.assign(['0px', '4px'], { small: '4px' })
    const when = new Date(0)
    const scale = (value: number) => value * 4
    const theme = Object.defineProperty({ space, sizes: { when, scale } }, 'helper', {
      value: 'kept',
    })
    const native = convert(theme)
    expect(native.space).toEqual(Object.assign([0, 4], { small: 4 }))
    expect(Array.isArray(native.space)).toBe(true)
    expect(native.sizes.when).toBe(when)
    expect(native.sizes.scale).toBe(scale)
    expect((native as unknown as { helper: string }).helper).toBe('kept')
    expect(space[1]).toBe('4px')
  })

  it('takes other length keys and another base for rem', () => {
    const theme = { space: ['8px'], lineHeights: { body: '1.5rem', tight: '20px' } }
    expect(toNativeTheme(theme, ['lineHeights'], 10)).toEqual({
      space: ['8px'],
      lineHeights: { body: 15, tight: 20 },
    })
  })
})

describe('the type of a converted theme', () => {
  it('is a number for a length literal, string | number for a string, and the rest as it was', () => {
    const theme = {
      space: ['0px', '4px', '1rem', '8'] as const,
      sizes: { full: '100%', fit: 'auto', icon: '16px' } as const,
      radii: { sm: '2px' },
      fontSizes: [12, 14],
      borderWidths: { thin: 1, scale: (value: number) => value },
      palette: { primary: '#1b5fd1' },
      lineHeights: { tight: '20px' } as const,
    }
    type Native = NativeTheme<typeof theme>
    expectTypeOf<Native['space']>().toEqualTypeOf<readonly [number, number, number, number]>()
    expectTypeOf<Native['sizes']>().toEqualTypeOf<{
      readonly full: '100%'
      readonly fit: 'auto'
      readonly icon: number
    }>()
    expectTypeOf<Native['radii']>().toEqualTypeOf<{ sm: string | number }>()
    expectTypeOf<Native['fontSizes']>().toEqualTypeOf<number[]>()
    expectTypeOf<Native['borderWidths']['scale']>().toEqualTypeOf<(value: number) => number>()
    expectTypeOf<Native['palette']>().toEqualTypeOf<{ primary: string }>()
    expectTypeOf<Native['lineHeights']>().toEqualTypeOf<{ readonly tight: '20px' }>()
    expectTypeOf(convert(theme).space).toEqualTypeOf<readonly [number, number, number, number]>()
  })

  it('keeps an optional key optional', () => {
    expectTypeOf<NativeTheme<{ space?: string[] }>>().toEqualTypeOf<{
      space?: (string | number)[]
    }>()
  })
})
