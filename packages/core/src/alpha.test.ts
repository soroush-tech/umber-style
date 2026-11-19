import { alpha, isAlphaColor, type AlphaColor } from './alpha'
import { createCache, createMemorySheet } from './cache'
import { add, multiply } from './calc'
import { compileRules, mergeStyles } from './serialize'

/** The result of `alpha()` for an opacity between 0 and 1: never a plain string. */
function mix(color: string, opacity: number): AlphaColor {
  const result = alpha(color, opacity)
  if (typeof result === 'string') throw new TypeError(`expected a mix, got ${result}`)
  return result
}

describe('alpha', () => {
  it('mixes the color with transparent, also for a variable', () => {
    expect(String(alpha('var(--ds-palette-primary)', 0.5))).toBe(
      'color-mix(in srgb, var(--ds-palette-primary) 50%, transparent)'
    )
  })

  it('rounds the percent to two decimals', () => {
    expect(String(alpha('red', 0.12345))).toBe('color-mix(in srgb, red 12.35%, transparent)')
  })

  it('returns the color itself for 1, with no mix, and transparent for 0', () => {
    expect(alpha('red', 1)).toBe('red')
    expect(alpha('var(--x)', 1)).toBe('var(--x)')
    expect(alpha('red', 0)).toBe('transparent')
  })

  it('throws a RangeError for an opacity outside 0 to 1, NaN included', () => {
    for (const opacity of [-0.1, 1.1, 50, Number.NaN, Infinity, -Infinity]) {
      expect(() => alpha('red', opacity)).toThrow(RangeError)
    }
  })

  it('throws a TypeError for a color that is not a string or an opacity that is not a number', () => {
    expect(() => alpha(1 as unknown as string, 0.5)).toThrow(TypeError)
    expect(() => alpha('red', '0.5' as unknown as number)).toThrow(TypeError)
  })
})

describe('the result of alpha', () => {
  it('has a fallback and a value, and is frozen', () => {
    const result = mix('var(--x)', 0.25)
    expect(result.fallback).toBe('var(--x)')
    expect(result.value).toBe('color-mix(in srgb, var(--x) 25%, transparent)')
    expect(Object.isFrozen(result)).toBe(true)
    expect(isAlphaColor(result)).toBe(true)
  })

  it('is told from a string, a style object, null and an object without the brand', () => {
    expect(isAlphaColor('red')).toBe(false)
    expect(isAlphaColor({ fallback: 'a', value: 'b' })).toBe(false)
    expect(isAlphaColor(null)).toBe(false)
    expect(isAlphaColor(undefined)).toBe(false)
  })

  it('is the color-mix form in a string, so that interpolation stays valid CSS', () => {
    const value = mix('#ff0000', 0.5)
    const text = `1px solid ${value}`
    expect(text).toBe('1px solid color-mix(in srgb, #ff0000 50%, transparent)')
    expect(String(value)).toBe(value.value)
    expect(`${value}` + '').toBe(value.value)
  })
})

describe('the fallback of a literal color', () => {
  it('is rgba() for #rrggbb and #rgb, with the opacity applied', () => {
    expect(mix('#ff8000', 0.5).fallback).toBe('rgba(255, 128, 0, 0.5)')
    expect(mix('#F80', 0.25).fallback).toBe('rgba(255, 136, 0, 0.25)')
  })

  it('multiplies the alpha of #rrggbbaa and #rgba', () => {
    expect(mix('#ff800080', 0.5).fallback).toBe('rgba(255, 128, 0, 0.251)')
    expect(mix('#f808', 0.5).fallback).toBe('rgba(255, 136, 0, 0.2667)')
  })

  it('is rgba() for rgb() and rgba() with numbers, in the comma and the space syntax', () => {
    expect(mix('rgb(10, 20, 30)', 0.5).fallback).toBe('rgba(10, 20, 30, 0.5)')
    expect(mix('rgb(10 20 30)', 0.5).fallback).toBe('rgba(10, 20, 30, 0.5)')
    expect(mix('RGBA(10,20,30,0.4)', 0.5).fallback).toBe('rgba(10, 20, 30, 0.2)')
    expect(mix('rgb(10 20 30 / 50%)', 0.5).fallback).toBe('rgba(10, 20, 30, 0.25)')
    expect(mix('rgb(0 0 0 / 0.5)', 0.5).fallback).toBe('rgba(0, 0, 0, 0.25)')
  })

  it('rounds and limits the channels and the alpha of rgb()', () => {
    expect(mix('rgb(300, -5, 1.6)', 0.5).fallback).toBe('rgba(255, 0, 2, 0.5)')
    expect(mix('rgb(1, 2, 3, 200%)', 0.5).fallback).toBe('rgba(1, 2, 3, 0.5)')
    expect(mix('rgb(1, 2, 3, -1)', 0.5).fallback).toBe('rgba(1, 2, 3, 0)')
  })

  it('reads a color with spaces around it', () => {
    expect(mix(' #fff ', 0.5).fallback).toBe('rgba(255, 255, 255, 0.5)')
  })
})

describe('the fallback of any other color', () => {
  it('is the color itself, at full opacity', () => {
    for (const color of [
      'var(--css-palette-primary)',
      'red',
      'hsl(10 20% 30%)',
      'rgb(10%, 20%, 30%)',
      'rgb(var(--r), 0, 0)',
      'rgb(1, 2 3)',
      '#ff',
      '#fffff',
      'color-mix(in srgb, red, blue)',
    ]) {
      expect(mix(color, 0.5).fallback).toBe(color)
    }
  })
})

describe('an alpha color in a style', () => {
  const primary = alpha('var(--x)', 0.1)
  const mixed = 'color-mix(in srgb, var(--x) 10%, transparent)'

  it('is written as the fallback and then the mix, when it is the whole value', () => {
    expect(compileRules('.a', { background: primary })).toEqual([
      `.a{background:var(--x);background:${mixed};}`,
    ])
    expect(compileRules('.a', { color: alpha('#ff0000', 0.5), padding: 4 })).toEqual([
      '.a{color:rgba(255, 0, 0, 0.5);color:color-mix(in srgb, #ff0000 50%, transparent);padding:4px;}',
    ])
  })

  it('is written as the mix alone without color fallbacks', () => {
    expect(compileRules('.a', { background: primary }, false)).toEqual([`.a{background:${mixed};}`])
  })

  it('is written as the mix alone in a custom property, where a fallback would always win', () => {
    expect(compileRules('.a', { '--tint': primary })).toEqual([`.a{--tint:${mixed};}`])
  })

  it('is written item by item in a list, and in a nested rule', () => {
    expect(compileRules('.a', { background: [primary, 'red'] })).toEqual([
      `.a{background:var(--x);background:${mixed};background:red;}`,
    ])
    expect(compileRules('.a', { '&:hover': { color: primary } })).toEqual([
      `.a:hover{color:var(--x);color:${mixed};}`,
    ])
    expect(compileRules('.a', { '@media print': { color: primary } }, false)).toEqual([
      `@media print{.a{color:${mixed};}}`,
    ])
  })

  it('is just the mix inside a longer string', () => {
    expect(compileRules('.a', { border: `1px solid ${primary}` })).toEqual([
      `.a{border:1px solid ${mixed};}`,
    ])
  })

  it('is a value, not a nested style, for mergeStyles: the later one replaces it whole', () => {
    const first = alpha('#000', 0.5)
    const second = alpha('#fff', 0.5)
    expect(mergeStyles([{ color: first }, { color: second }]).color).toBe(second)
    expect(mergeStyles([{ color: 'red' }, { color: first }]).color).toBe(first)
    expect(mergeStyles([{ color: first }, { color: 'red' }]).color).toBe('red')
  })

  it('goes through the cache: both declarations in the class, one class for the same value', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'a', hasLayers: false, sheet })
    const className = cache.css({ background: alpha('var(--a-x)', 0.1) })
    expect(sheet.rules).toEqual([
      `.${className}{background:var(--a-x);background:color-mix(in srgb, var(--a-x) 10%, transparent);}`,
    ])
    expect(cache.css({ background: alpha('var(--a-x)', 0.1) })).toBe(className)
  })

  it('goes through a cache without color fallbacks as the mix alone, and in another class', () => {
    const sheet = createMemorySheet()
    const cache = createCache({ prefix: 'a', hasLayers: false, hasColorFallbacks: false, sheet })
    const className = cache.css({ background: alpha('var(--a-x)', 0.1) })
    expect(sheet.rules).toEqual([
      `.${className}{background:color-mix(in srgb, var(--a-x) 10%, transparent);}`,
    ])
  })

  it('is not an operand of the arithmetic helpers', () => {
    const value = alpha('red', 0.5) as unknown as number
    expect(() => add(value, 1)).toThrow(TypeError)
    expect(() => multiply(value, 2)).toThrow(/alpha\(\) color is not a length/)
  })
})
