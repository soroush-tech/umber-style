// The components that the React benchmarks render. They are made over a style object (`createStyle`
// of the client build, or `bindEngine` of the server components build), so that one definition serves
// both builds. React and the core are arguments: `client.ts` and `server.ts` load them, built and with
// the conditions of their build, and give them here.
import type * as Core from '@umber-style/core'
import type { EngineOptions } from '@umber-style/core'
import type * as React from 'react'
import type { ReactNode } from 'react'
import {
  createCombinations,
  createLayoutStyle,
  LAYOUT_FIXED,
  type LayoutProps,
} from '../../../bench/src/styles'
import { createSmallTheme, type SmallTheme } from '../../../bench/src/themes'
import type { WebStyle } from '../src/types'

export const theme: SmallTheme = createSmallTheme()

/** A second theme with other values, for a provider that nests. */
export const otherTheme = {
  palette: { primary: '#d1531b', text: '#222222' },
}

export const combinations = createCombinations(48)

/** The five kinds of the 48-element cases, and their names in a case. */
export const kinds = ['fixed', 'themed', 'flex', 'override', 'entry'] as const
export type Kind = (typeof kinds)[number]
export const labels: Record<Kind, string> = {
  fixed: 'fixed styles only',
  themed: 'a function of the theme only',
  flex: 'prop-driven, 48 combinations',
  override: 'an override through style',
  entry: 'a single sheet entry in style',
}

const LAYOUT_PROPS = new Set(['gap', 'direction', 'align', 'justify', 'wrap', 'padding'])
const TONES = ['a', 'b', 'c', 'd'] as const
type Tone = (typeof TONES)[number]

/** The parts of a style object that the components need: `styled`, `StyleSheet` and `ThemeProvider`. */
export type BenchStyle = Pick<WebStyle<SmallTheme>, 'styled' | 'StyleSheet' | 'ThemeProvider'>

const ROWS = 100
const CELLS = 4

/** A key that tells the combination of props apart: the 48 are distinct. */
const keyOf = ({ gap, direction, align, justify, wrap }: LayoutProps): string =>
  [gap, direction, align, justify, wrap].join('|')

/** The fixtures over one copy of React and of the built core. */
export function createFixtures(react: typeof React, core: typeof Core) {
  const h = react.createElement

  /** Engine options for a benchmark: a fresh in-memory sheet, and no development checks. */
  function createBenchOptions(): EngineOptions {
    return {
      prefix: 'b',
      cache: core.createCache({
        prefix: 'b',
        sheet: core.createMemorySheet(),
        hasDevChecks: false,
      }),
    }
  }

  /** Every component of the benchmarks, over `style`. */
  function createComponents(style: BenchStyle) {
    const { styled, StyleSheet } = style

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
    })<LayoutProps>(LAYOUT_FIXED, (props) => createLayoutStyle(props))

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

  type Components = ReturnType<typeof createComponents>

  /** 48 elements of one component, each a distinct combination for `Flex`. */
  function createFortyEight(components: Components, kind: Kind): ReactNode[] {
    const { Fixed, Themed, Flex, sheet } = components
    return combinations.map((props) => {
      const key = keyOf(props)
      switch (kind) {
        case 'fixed':
          return h(Fixed, { key })
        case 'themed':
          return h(Themed, { key })
        case 'flex':
          return h(Flex, { key, ...props })
        case 'override':
          return h(Fixed, { key, style: { margin: 4, outline: '1px solid blue' } })
        case 'entry':
          return h(Fixed, { key, style: sheet.root })
      }
    })
  }

  /**
   * The tree of 500 styled elements: 100 rows, each a `Flex` with four `Cell`s. The row takes one of the
   * 48 combinations and the cell one of four tones; `shift` moves both, so that a render with another
   * `shift` has other props everywhere and another class on most elements.
   */
  function Tree({ components, shift = 0 }: { components: Components; shift?: number }): ReactNode {
    const { Flex, Cell } = components
    return Array.from({ length: ROWS }, (_, row) =>
      h(
        Flex,
        { key: row, ...combinations[(row + shift) % combinations.length] },
        Array.from({ length: CELLS }, (_, cell) =>
          h(Cell, { key: cell, tone: TONES[(cell + shift) % TONES.length] }, row)
        )
      )
    )
  }

  /** `children` inside a provider of `style` with `value` (the small theme by default). */
  function provide(style: BenchStyle, children: ReactNode, value: object = theme) {
    return h(style.ThemeProvider, { theme: value }, children)
  }

  /** The tree inside a provider, as one element. */
  function createTreeApp(style: BenchStyle, components: Components, shift = 0) {
    return provide(style, h(Tree, { components, shift }))
  }

  return { createBenchOptions, createComponents, createFortyEight, provide, createTreeApp }
}
