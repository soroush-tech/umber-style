// The type tests of the web style through the Vue binding: `pnpm typecheck` compiles this file.
import {
  createCache,
  createMemorySheet,
  type AlphaColor,
  type NestedKey,
  type SheetEntry,
  type StyleObject,
  type WebNested,
  type WebProperties,
  type WebStyleObject,
} from '@umber-style/core'
import { expectTypeOf } from 'vitest'
import { createStyle } from './createStyle'
import {
  at,
  type AlphaColor as VueAlpha,
  type NestedKey as VueKey,
  type SchemeKey as VueSchemeKey,
  type SchemeName as VueSchemeName,
  type SheetEntry as VueEntry,
  type StyleObject as VueLoose,
  type ThemeKey as VueThemeKey,
  type WebNested as VueNested,
  type WebProperties as VueProperties,
  type WebStyleObject as VueWebStyle,
} from './index'

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(
    { palette: { primary: '#0000ff' }, space: [0, 4, 8] },
    { prefix: 'v', cache: createCache({ prefix: 'v', sheet }) }
  )
  return { ...style, sheet }
}

describe('what a web style accepts through the Vue binding', () => {
  it('accepts properties, fallbacks, nested selectors, at-rules, custom properties and label', () => {
    const { styled, sheet, apply, cache } = setup()
    const Box = styled('div')({
      label: 'box',
      display: 'grid',
      padding: 8,
      margin: ['1px', '2px'],
      '--accent': '#ff0000',
      '&:hover': { opacity: 0.8 },
      ':first-child': { margin: 0 },
      '@media (min-width: 40em)': { padding: 16 },
    })
    expectTypeOf(Box).toBeFunction()
    expect(sheet.rules).toEqual([])
    expect(apply(cache.css({ '--accent': 'red' }))).toHaveProperty('class')
    expect(sheet.rules.join('')).toContain('--accent:red;')
  })

  it('accepts a style function with the theme, returning a style, null or false', () => {
    const { styled } = setup()
    styled('div')(({ theme }) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      return Math.random() > 2 ? null : { color: theme.palette.primary, '&:hover': { opacity: 1 } }
    })
  })

  it('rejects a misspelt property and a wrong value', () => {
    const { styled } = setup()
    const rejected = [
      // @ts-expect-error `backgroudColor` is not a property
      styled('div')({ backgroudColor: 'red' }),
      // @ts-expect-error `gird` is not a display value
      styled('div')({ display: 'gird' }),
      styled('div')({
        '&:hover': {
          // @ts-expect-error a misspelt property in a nested style
          paddng: 1,
        },
      }),
      // @ts-expect-error a selector needs `&`
      styled('div')({ '> li': { color: 'red' } }),
    ]
    expectTypeOf(rejected).items.not.toBeAny()
  })

  it('does not catch a typo in a widened object or in an untyped return, and takes the loose type through a cast', () => {
    const { styled } = setup()
    const widened = { color: 'red', backgroudColor: 'red' }
    const accepted = [styled('div')(widened), styled('div')(() => ({ backgroudColor: 'red' }))]
    const loose: StyleObject = { anything: 'goes' }
    const loosened = [
      // @ts-expect-error the loose type is not accepted as it is
      styled('div')(loose),
      styled('div')(loose as WebStyleObject),
    ]
    expectTypeOf(accepted).items.not.toBeAny()
    expectTypeOf(loosened).items.not.toBeAny()
  })

  it('checks a sheet, an object and a function of the theme', () => {
    const { StyleSheet } = setup()
    const accepted = StyleSheet.create({ box: { padding: 8, '&:hover': { opacity: 0.8 } } })
    StyleSheet.create((theme) => ({ box: { color: theme.palette.primary } }))
    // @ts-expect-error a misspelt property in a sheet
    StyleSheet.create({ box: { backgroudColor: 'red' } })
    // @ts-expect-error a wrong value in a sheet
    StyleSheet.create({ box: { display: 'gird' } })
    expectTypeOf(accepted.box).toHaveProperty('className')
  })
})

describe('the style types of the Vue binding', () => {
  it('are re-exported for an app that annotates a style or uses satisfies', () => {
    expectTypeOf<VueWebStyle>().toEqualTypeOf<WebStyleObject>()
    expectTypeOf<VueProperties>().toEqualTypeOf<WebProperties>()
    expectTypeOf<VueNested>().toEqualTypeOf<WebNested>()
    expectTypeOf<VueKey>().toEqualTypeOf<NestedKey>()
    expectTypeOf<VueLoose>().toEqualTypeOf<StyleObject>()
    expectTypeOf<VueAlpha>().toEqualTypeOf<AlphaColor>()
    expectTypeOf<VueEntry>().toEqualTypeOf<SheetEntry>()
    const key: VueThemeKey | VueSchemeKey | VueSchemeName = 'dark'
    expect(key).toBe('dark')
    const style = { color: 'red', ...at(`&.${'open'}`, { margin: 0 }) } satisfies VueWebStyle
    expect(Object.keys(style)).toEqual(['color', '&.open'])
  })
})
