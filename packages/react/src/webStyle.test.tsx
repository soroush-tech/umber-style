// The type tests of the web style: `pnpm typecheck` compiles this file.
import { render } from '@testing-library/react'
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
  type AlphaColor as ClientAlpha,
  type NestedKey as ClientKey,
  type SchemeKey as ClientSchemeKey,
  type SchemeName as ClientSchemeName,
  type SheetEntry as ClientEntry,
  type StyleObject as ClientLoose,
  type ThemeKey as ClientThemeKey,
  type WebNested as ClientNested,
  type WebProperties as ClientWebProperties,
  type WebStyleObject as ClientWebStyle,
} from './index'
import {
  at as serverAt,
  type StyleObject as ServerLoose,
  type WebStyleObject as ServerWebStyle,
} from './index.server'

function setup() {
  const sheet = createMemorySheet()
  const style = createStyle(
    { palette: { primary: '#0000ff' }, space: [0, 4, 8] },
    { prefix: 'w', cache: createCache({ prefix: 'w', sheet }) }
  )
  return { ...style, rules: sheet.rules }
}

describe('what a web style accepts', () => {
  it('accepts properties, numbers, fallbacks, nested selectors, at-rules, custom properties and label', () => {
    const { styled, rules } = setup()
    const Box = styled('div')({
      label: 'box',
      display: 'grid',
      padding: 8,
      margin: ['1px', '2px'],
      fontWeight: 600,
      opacity: 0.5,
      width: ['100%', 'fit-content'],
      '--accent': '#ff0000',
      '--size': 4,
      '&:hover': { opacity: 0.8, '&:focus': { outline: 'none' } },
      ':first-child': { margin: 0 },
      '& > li': { color: 'red' },
      '@media (min-width: 40em)': { padding: 16, '&:hover': { opacity: 1 } },
      '@supports (display: grid)': { display: 'grid' },
    })
    render(<Box />)
    expect(rules.join('')).toContain('--accent:#ff0000;')
  })

  it('accepts a condition that gives false, null or undefined, at the top or nested', () => {
    const { styled } = setup()
    const isOpen = Math.random() > 2
    styled('div')({
      color: isOpen && 'red',
      margin: null,
      padding: undefined,
      '&:hover': isOpen && { color: 'red' },
      '@media print': null,
    })
  })

  it('accepts a style function that returns a style, null or false, and gives it the props', () => {
    const { styled } = setup()
    const Box = styled('div')<{ tone?: 'a' | 'b' }>(({ tone, theme }) => {
      expectTypeOf(tone).toEqualTypeOf<'a' | 'b' | undefined>()
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      return tone === 'a' && { '&:hover': { color: theme.palette.primary }, '--x': 1 }
    })
    expectTypeOf(Box).toBeFunction()
  })

  it('rejects a misspelt property in an object literal', () => {
    const { styled } = setup()
    // @ts-expect-error `backgroudColor` is not a property
    styled('div')({ backgroudColor: 'red' })
    // @ts-expect-error a misspelt property next to valid ones
    styled('div')({ color: 'red', backgroudColor: 'red' })
    styled('div')({
      '&:hover': {
        // @ts-expect-error a misspelt property in a nested style
        backgroudColor: 'red',
      },
    })
    styled('div')({
      '@media print': {
        // @ts-expect-error a misspelt property in an at-rule
        paddng: 1,
      },
    })
  })

  it('rejects a wrong value', () => {
    const { styled } = setup()
    // @ts-expect-error `gird` is not a display value
    styled('div')({ display: 'gird' })
    // @ts-expect-error a number is not a display value
    styled('div')({ display: 4 })
    // @ts-expect-error a boolean is not a value
    styled('div')({ padding: true })
    // @ts-expect-error a custom property is a string or a number
    styled('div')({ '--x': { a: 1 } })
  })

  it('rejects a key that is neither a property, a selector nor an at-rule', () => {
    const { styled } = setup()
    // @ts-expect-error a selector needs `&` (or to start with `:`): `& > li`
    styled('div')({ '> li': { color: 'red' } })
    // @ts-expect-error `hover` is not a property name
    styled('div')({ hover: { color: 'red' } })
  })

  it('does not catch what a variable holds: a typo in a widened object is accepted', () => {
    const { styled } = setup()
    const widened = { color: 'red', backgroudColor: 'red' }
    styled('div')(widened)
    const onlyTypo = { backgroudColor: 'red' }
    styled('div')(onlyTypo)
  })

  it('does not catch a typo in an object that a style function returns, unless the return is typed', () => {
    const { styled } = setup()
    styled('div')(() => ({ backgroudColor: 'red' }))
    // @ts-expect-error a typed return is checked
    styled('div')((): WebStyleObject => ({ backgroudColor: 'red' }))
    // @ts-expect-error `satisfies` checks the literal too
    styled('div')(() => ({ backgroudColor: 'red' }) satisfies WebStyleObject)
  })

  it('takes the loose style type through a cast', () => {
    const { styled } = setup()
    const loose: StyleObject = { anything: 'goes', '>li': { x: 1 } }
    // @ts-expect-error the loose type is not accepted as it is
    styled('div')(loose)
    styled('div')(loose as WebStyleObject)
  })
})

describe('what a sheet, the style prop and apply accept', () => {
  it('checks a sheet, an object and a function of the theme', () => {
    const { StyleSheet, styled, useStyle, apply } = setup()
    const sheet = StyleSheet.create({
      box: { padding: 8, '&:hover': { opacity: 0.8 } },
      active: { '--x': 1 },
    })
    StyleSheet.create((theme) => {
      expectTypeOf(theme.palette.primary).toEqualTypeOf<string>()
      return { box: { color: theme.palette.primary } }
    })
    // @ts-expect-error a misspelt property in a sheet
    StyleSheet.create({ box: { backgroudColor: 'red' } })
    // @ts-expect-error a wrong value in a sheet
    StyleSheet.create({ box: { display: 'gird' } })
    // The function form is not checked key by key: a returned literal is not a fresh object.
    StyleSheet.create(() => ({ box: { backgroudColor: 'red' } }))

    const Box = styled('div')()
    const Panel = () => {
      const styles = useStyle(sheet)
      expectTypeOf(styles.box).toEqualTypeOf<{ readonly className: string }>()
      return (
        <Box
          style={[styles.box, false, { opacity: 0.9, '&:hover': { opacity: 1 } }]}
          {...apply(styles.active)}
        />
      )
    }
    // @ts-expect-error a misspelt property in the style prop
    ;<Box style={{ backgroudColor: 'red' }} />
    // @ts-expect-error a wrong value in the style prop
    ;<Box style={[{ display: 'gird' }]} />
    expectTypeOf(Panel).toBeFunction()
  })
})

describe('the style types, from the client build and the server build', () => {
  it('are re-exported for an app that annotates a style or uses satisfies', () => {
    expectTypeOf<ClientWebStyle>().toEqualTypeOf<WebStyleObject>()
    expectTypeOf<ServerWebStyle>().toEqualTypeOf<WebStyleObject>()
    expectTypeOf<ClientWebProperties>().toEqualTypeOf<WebProperties>()
    expectTypeOf<ClientNested>().toEqualTypeOf<WebNested>()
    expectTypeOf<ClientKey>().toEqualTypeOf<NestedKey>()
    expectTypeOf<ClientLoose>().toEqualTypeOf<StyleObject>()
    expectTypeOf<ClientAlpha>().toEqualTypeOf<AlphaColor>()
    expectTypeOf<ClientEntry>().toEqualTypeOf<SheetEntry>()
    expectTypeOf<ServerLoose>().toEqualTypeOf<StyleObject>()
    const key: ClientThemeKey | ClientSchemeKey | ClientSchemeName = 'dark'
    expect(key).toBe('dark')
    const style = { color: 'red', ...at(`&.${'open'}`, { margin: 0 }) } satisfies ClientWebStyle
    expect(Object.keys(style)).toEqual(['color', '&.open'])
    expect(serverAt).toBe(at)
  })
})
