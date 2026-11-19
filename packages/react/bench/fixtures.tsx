// The components that the React benchmarks render. They are made over a style object (`createStyle`
// of the client build, or of the server components build), so that one definition serves both builds
// and every option variant.
import { createCache, createMemorySheet } from '@umber-style/core'
import type { CacheOptions, EngineOptions } from '@umber-style/core'
import {
  createCombinations,
  createLayoutStyle,
  LAYOUT_FIXED,
  type LayoutProps,
} from '@umber-bench/shared/styles'
import { createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'
import type { ReactNode } from 'react'
import type { WebStyle } from '../src/types'

export const theme: SmallTheme = createSmallTheme()

/** A second theme with other values, for a provider that changes or nests. */
export const otherTheme = {
  palette: { primary: '#d1531b', text: '#222222' },
}

export const combinations = createCombinations(48)

const LAYOUT_PROPS = new Set(['gap', 'direction', 'align', 'justify', 'wrap', 'padding'])
const TONES = ['a', 'b', 'c', 'd'] as const
export type Tone = (typeof TONES)[number]

/** Engine options for a benchmark: a fresh in-memory sheet, so that no style element of jsdom is involved. */
export function createBenchOptions(options: CacheOptions = {}): EngineOptions {
  return {
    prefix: 'b',
    cache: createCache({
      prefix: 'b',
      sheet: createMemorySheet(),
      hasDevChecks: false,
      ...options,
    }),
  }
}

/** The `StyleSheet.create` and `styled` parts of a style object, which is all the components need. */
export type BenchStyle = Pick<
  WebStyle<SmallTheme>,
  'styled' | 'StyleSheet' | 'ThemeProvider' | 'when'
>

/**
 * Every component of the benchmarks, over `style`. With `hasCondition` the prop-driven component has a
 * style that applies only inside another theme (a `when()` key), for the option that decides how that
 * is written.
 */
export function createComponents(style: BenchStyle, hasCondition = false) {
  const { styled, StyleSheet, when } = style
  const darkKey = when(otherTheme)

  /** Fixed styles only: no function, so no theme is read. */
  const Fixed = styled('div', { name: 'Fixed' })({ display: 'flex', padding: 8, color: 'red' })

  /** A function of the theme only. */
  const Themed = styled('div', { name: 'Themed' })(({ theme: view }) => ({
    color: view.palette.primary,
    padding: view.space[2],
    borderRadius: view.radii.md,
  }))

  /** Fixed styles, then a function of six props. */
  const Flex = styled('div', {
    name: 'Flex',
    shouldForwardProp: (prop) => !LAYOUT_PROPS.has(prop),
  })<LayoutProps>(LAYOUT_FIXED, (props) => ({
    ...createLayoutStyle(props),
    ...(hasCondition ? { [darkKey]: { borderColor: 'red', opacity: 0.9 } } : {}),
  }))

  /** A leaf of the tree: a theme function, then one prop. */
  const Cell = styled('span', { name: 'Cell', shouldForwardProp: (prop) => prop !== 'tone' })<{
    tone: Tone
  }>(
    ({ theme: view }) => ({ color: view.palette.text, padding: view.space[1] }),
    ({ tone }) => ({ opacity: (TONES.indexOf(tone) + 1) / 4 })
  )

  const sheet = StyleSheet.create({
    root: { margin: 4, outline: '1px solid blue' },
    other: { margin: 8 },
  })

  return { Fixed, Themed, Flex, Cell, sheet }
}

export type Components = ReturnType<typeof createComponents>

/** 48 elements of one component, each a distinct combination for `Flex`. */
export function createFortyEight(
  components: Components,
  kind: 'fixed' | 'themed' | 'flex' | 'override' | 'entry'
): ReactNode[] {
  const { Fixed, Themed, Flex, sheet } = components
  return combinations.map((props, index) => {
    switch (kind) {
      case 'fixed':
        return <Fixed key={index} />
      case 'themed':
        return <Themed key={index} />
      case 'flex':
        return <Flex key={index} {...props} />
      case 'override':
        return <Fixed key={index} style={{ margin: 4, outline: '1px solid blue' }} />
      case 'entry':
        return <Fixed key={index} style={sheet.root} />
    }
  })
}

const ROWS = 100
const CELLS = 4

/**
 * The tree of 500 styled elements: 100 rows, each a `Flex` with four `Cell`s. The row takes one of the
 * 48 combinations and the cell one of four tones; `shift` moves both, so that a render with another
 * `shift` has other props everywhere and another class on most elements.
 */
export function Tree({
  components,
  shift = 0,
}: {
  components: Components
  shift?: number
}): ReactNode {
  const { Flex, Cell } = components
  return Array.from({ length: ROWS }, (_, row) => (
    <Flex key={row} {...combinations[(row + shift) % combinations.length]}>
      {Array.from({ length: CELLS }, (_, cell) => (
        <Cell key={cell} tone={TONES[(cell + shift) % TONES.length]}>
          {row}
        </Cell>
      ))}
    </Flex>
  ))
}

/** How many styled elements `Tree` renders. */
export const TREE_ELEMENTS = ROWS * (CELLS + 1)
