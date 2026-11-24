// What the React Native benchmarks share. The process is first made to run built code
// (`prepareBuiltPackages`: production React, the built core, `react-native` sent to the stand-in in
// `platform.ts`, and `react-native-reanimated`, for the animated entry, to the one in `reanimated.ts`), then React, `react-dom/server` and the built binding are loaded after it. A file
// imports this module before anything that loads React.
import { createRequire } from 'node:module'
import type * as React from 'react'
import type * as ReactDomServer from 'react-dom/server'
import { prepareBuiltPackages } from '../../../bench/src/built'
import {
  createLayoutKey,
  LAYOUT_PROPS,
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
import type { NativeStyleObject } from '../src/nativeStyle'

prepareBuiltPackages({
  redirects: {
    'react-native': new URL('./platform.ts', import.meta.url).href,
    'react-native-reanimated': new URL('./reanimated.ts', import.meta.url).href,
  },
})
const load = createRequire(import.meta.url)
const { createElement: h } = load('react') as typeof React
const { renderToString } = load('react-dom/server') as typeof ReactDomServer
const { createStyle } = load('../dist/index.cjs') as typeof Binding

export const theme: SmallTheme = createSmallTheme()
const combinations = createCombinations(48)

/** A stand-in for a native view: it renders an empty element around its children and drops the rest. */
const View = ({ children }: { children?: React.ReactNode }) => h('view', null, children)

/** The components over a fresh style object. */
export function createSetup() {
  const style = createStyle(theme)
  const { styled, StyleSheet } = style
  const Fixed = styled(View)({ display: 'flex', padding: 8, backgroundColor: 'red' })
  const Themed = styled(View)(({ theme: view }) => ({
    backgroundColor: view.palette.primary,
    padding: view.space[2],
    borderRadius: view.radii.md,
  }))
  const Flex = styled(View, { shouldForwardProp: (prop) => !LAYOUT_PROPS.has(prop) })<LayoutProps>(
    LAYOUT_FIXED as NativeStyleObject,
    (props) => ({
      ...(createLayoutStyle(props) as NativeStyleObject),
      alignItems: props.align,
    })
  )
  const Cell = styled(View, { shouldForwardProp: (prop) => prop !== 'tone' })<{ tone: Tone }>(
    ({ theme: view }) => ({ backgroundColor: view.palette.text, padding: view.space[1] }),
    ({ tone }) => ({ opacity: (TONES.indexOf(tone) + 1) / 4 })
  )
  const sheet = StyleSheet.create({ root: { margin: 4 }, other: { margin: 8 } })
  return { style, Fixed, Themed, Flex, Cell, sheet }
}
type Setup = ReturnType<typeof createSetup>

/** 48 elements of one component, each a distinct combination for `Flex`. */
export function createFortyEight(setup: Setup, kind: Kind): React.ReactNode[] {
  const { Fixed, Themed, Flex, sheet } = setup
  return combinations.map((props) => {
    const key = createLayoutKey(props)
    switch (kind) {
      case 'fixed':
        return h(Fixed, { key })
      case 'themed':
        return h(Themed, { key })
      case 'flex':
        return h(Flex, { key, ...props })
      case 'override':
        return h(Fixed, { key, style: { margin: 4 } })
      case 'entry':
        return h(Fixed, { key, style: sheet.root })
    }
  })
}

/** The tree of 500 styled elements: 100 rows, each a `Flex` with four `Cell`s. */
export function createTree({ Flex, Cell }: Setup): React.ReactNode[] {
  return Array.from({ length: 100 }, (_, row) =>
    h(
      Flex,
      { key: row, ...combinations[row % combinations.length] },
      Array.from({ length: 4 }, (_, cell) => h(Cell, { key: cell, tone: TONES[cell] }, row))
    )
  )
}

/** The operation: a render of `children` inside a provider, over a fresh setup, after one render before it. */
export function prepare(children: (setup: Setup) => React.ReactNode): () => string {
  const setup = createSetup()
  const element = h(setup.style.ThemeProvider, { theme }, children(setup))
  renderToString(element)
  return () => renderToString(element)
}
