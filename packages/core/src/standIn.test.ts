import { add, divide, multiply, negate, subtract } from './calc'
import { alpha } from './alpha'
import { createStandIn, isStandIn, readStandIn } from './standIn'

type Read = Record<string, Record<string | number, unknown>>

describe('createStandIn', () => {
  it('reads as its path at any depth and through array indexes, and the root as nothing', () => {
    const theme = createStandIn('') as Read & { space: unknown[] }
    expect(String(theme.palette.primary)).toBe('palette.primary')
    expect(`${(theme.space as unknown[])[2]}px`).toBe('space.2px')
    expect(String((theme.a.b as Read).c)).toBe('a.b.c')
    expect(String(theme)).toBe('')
  })

  it('reads a call of a helper of the theme as the path with its arguments, and goes on from there', () => {
    const theme = createStandIn('') as unknown as {
      breakpoints: { up(name: string): string; between(a: string, b: number): { x: string } }
    }
    expect(String(theme.breakpoints.up('md'))).toBe('breakpoints.up(md)')
    expect(String(theme.breakpoints.between('sm', 2).x)).toBe('breakpoints.between(sm,2).x')
    expect(`${theme.breakpoints.up('lg')}`).toBe('breakpoints.up(lg)')
  })

  it('reads a symbol as undefined', () => {
    const theme = createStandIn('palette') as Record<symbol, unknown>
    expect(theme[Symbol.iterator]).toBeUndefined()
  })
})

describe('isStandIn and readStandIn', () => {
  it('tell a stand-in from any other value by its brand', () => {
    const standIn = createStandIn('palette.muted')
    expect(isStandIn(standIn)).toBe(true)
    for (const value of [{}, null, undefined, 'palette.muted', 4, alpha('#fff', 0.5), [], String]) {
      expect(isStandIn(value)).toBe(false)
    }
    expect(readStandIn(standIn)).toBe('palette.muted')
    expect(readStandIn('var(--x)')).toBe('var(--x)')
    expect(readStandIn(4)).toBe(4)
  })
})

describe('the helpers with a stand-in', () => {
  const space = createStandIn('space.2') as unknown as string
  const gap = createStandIn('space.1') as unknown as string
  const color = createStandIn('palette.primary') as unknown as string

  it('compute with its path as they do with a reference', () => {
    expect(multiply(space, 2)).toBe('calc(space.2 * 2)')
    expect(divide(space, 2)).toBe('calc(space.2 / 2)')
    expect(negate(space)).toBe('calc(space.2 * -1)')
    expect(add(space, gap, 4)).toBe('calc(space.2 + space.1 + 4px)')
    expect(subtract(space, gap)).toBe('calc(space.2 - space.1)')
    expect(String(alpha(color, 0.5))).toBe('color-mix(in srgb, palette.primary 50%, transparent)')
    expect(alpha(color, 1)).toBe('palette.primary')
  })

  it('still throw for every other object', () => {
    const other = {} as unknown as string
    expect(() => multiply(other, 2)).toThrow('multiply(): a value must be a number, got object')
    expect(() => add(space, other)).toThrow('add(): a value must be a number, got object')
    expect(() => subtract(other, space)).toThrow('subtract(): a value must be a number, got object')
    expect(() => alpha(other, 0.5)).toThrow('alpha(): the color must be a string, got object')
  })
})

describe('listing the keys of a stand-in', () => {
  it('throws, so that two functions that only list keys do not get one name', () => {
    const theme = createStandIn('') as unknown as { palette: Record<string, string> }

    expect(() => Object.keys(theme.palette)).toThrow(/cannot list the keys of "palette"/)
    expect(() => ({ ...theme.palette })).toThrow(TypeError)
  })
})

describe('a function given to a helper of a stand-in', () => {
  it('throws, because what it closes over is not in its text', () => {
    const theme = createStandIn('') as unknown as {
      space: { map(fn: (value: number) => number): number[] }
      breakpoints: { up(key: unknown): string }
    }

    expect(() => theme.space.map((value) => value * 2)).toThrow(
      /cannot pass a function to "space.map"/
    )
    expect(String(theme.breakpoints.up(theme.space))).toBe('breakpoints.up(space)')
  })
})
