// What the Vue benchmarks share. The process is first made to run built code
// (`prepareBuiltPackages`: production Vue, the built core), then Vue, `vue/server-renderer` and the
// built binding are loaded after it. A file imports this module before anything that loads Vue.
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as Vue from 'vue'
import type * as ServerRenderer from 'vue/server-renderer'
import { prepareBuiltPackages } from '../../../bench/src/built'
import {
  cellStyle,
  createFixedStyle,
  createSheetEntries,
  LAYOUT_PROPS,
  themedStyle,
  TONES,
  type Kind,
  type Tone,
} from '../../../bench/src/components'
import {
  createCombinations,
  createLayoutStyle,
  LAYOUT_FIXED,
  type LayoutProps,
} from '../../../bench/src/styles'
import { createSmallTheme, type SmallTheme } from '../../../bench/src/themes'
import type * as Binding from '../src/index'

prepareBuiltPackages()
const load = createRequire(import.meta.url)
const { createSSRApp, h } = load('vue') as typeof Vue
const { renderToString } = load('vue/server-renderer') as typeof ServerRenderer
const { createStyle } = load('../dist/index.cjs') as typeof Binding
const core = load('../../core/dist/index.cjs') as typeof Core

const theme: SmallTheme = createSmallTheme()
const combinations = createCombinations(48)

/** A fresh style object over a fresh in-memory cache, and the components over it. */
export function createSetup() {
  const style = createStyle(theme, {
    prefix: 'b',
    cache: core.createCache({ prefix: 'b', sheet: core.createMemorySheet(), hasDevChecks: false }),
  })
  const { styled, StyleSheet } = style
  const Fixed = styled('div', { name: 'Fixed' })(createFixedStyle())
  const Themed = styled('div', { name: 'Themed' })(themedStyle)
  const Flex = styled('div', {
    name: 'Flex',
    shouldForwardProp: (prop) => !LAYOUT_PROPS.has(prop),
  })(LAYOUT_FIXED, (props) => createLayoutStyle(props as unknown as LayoutProps))
  const Cell = styled('span', { name: 'Cell', shouldForwardProp: (prop) => prop !== 'tone' })(
    cellStyle,
    ({ tone }) => ({ opacity: (TONES.indexOf(tone as Tone) + 1) / 4 })
  )
  const sheet = StyleSheet.create(createSheetEntries())
  return { style, Fixed, Themed, Flex, Cell, sheet }
}
export type Setup = ReturnType<typeof createSetup>

/** The 48 virtual nodes of one kind of component. */
export function createFortyEight(setup: Setup, kind: Kind): Vue.VNode[] {
  const { Fixed, Themed, Flex, sheet } = setup
  return combinations.map((props) => {
    switch (kind) {
      case 'fixed':
        return h(Fixed)
      case 'themed':
        return h(Themed)
      case 'flex':
        return h(Flex, { ...props })
      case 'override':
        return h(Fixed, { style: { margin: 4, outline: '1px solid blue' } })
      case 'entry':
        return h(Fixed, { style: sheet.root })
    }
  })
}

/**
 * The tree of 500 styled elements: 100 rows, each a `Flex` with four `Cell`s. `shift` moves the
 * combination of each row and the tone of each cell, so that a render with another `shift` has other
 * props everywhere.
 */
export function createTree(setup: Setup, shift = 0): Vue.VNode[] {
  const { Flex, Cell } = setup
  return Array.from({ length: 100 }, (_, row) =>
    h(Flex, { ...combinations[(row + shift) % combinations.length] }, () =>
      Array.from({ length: 4 }, (_, cell) =>
        h(Cell, { tone: TONES[(cell + shift) % TONES.length] }, () => String(row))
      )
    )
  )
}

/** 48 themed elements inside two providers, one in the other, each with its own partial theme: with the provider of `prepare` around them, three deep. */
export function createNested(setup: Setup): Vue.VNode[] {
  const { ThemeProvider } = setup.style
  return [
    h(ThemeProvider, { theme: { palette: { primary: '#d1531b' } } }, () =>
      h(ThemeProvider, { theme: { palette: { primary: '#123456' } } }, () =>
        createFortyEight(setup, 'themed')
      )
    ),
  ]
}

/** The operation: a server app that renders `children` inside a provider, made over a fresh setup and warmed once. */
export async function prepare(
  children: (setup: Setup) => Vue.VNode[]
): Promise<() => Promise<string>> {
  const setup = createSetup()
  const run = () =>
    renderToString(
      createSSRApp(() => h(setup.style.ThemeProvider, { theme }, () => children(setup)))
    )
  await run()
  return run
}
