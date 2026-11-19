// What one operation is, in this file: one `renderToString` of a new server app (`createSSRApp`, whose
// render function makes its virtual nodes in the render, as a component does) in Node, with the Vue
// binding. The app's creation is part of the time: a server makes one for each request.
//   48 elements   a provider with 48 elements of one component, over a warm cache (a render before the
//                 measurement made the classes). `flex` is the prop-driven component, one of 48
//                 combinations for each element; `override` has a style object in `style` (merged into
//                 an override class), `entry` a single sheet entry (used directly, no merge).
//   tree          a provider around the tree of 500 styled elements: 100 rows of `Flex` with four
//                 `Cell`s each, made in the render.
// Each case has an engine and a cache of its own, with an in-memory sheet. `renderToString` of Vue is
// asynchronous, so each operation also pays one turn of the microtask queue.
import { createCache, createMemorySheet } from '@umber-style/core'
import { runGroup } from '@umber-bench/shared/harness'
import {
  createCombinations,
  createLayoutStyle,
  LAYOUT_FIXED,
  type LayoutProps,
} from '@umber-bench/shared/styles'
import { createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'
import { createSSRApp, h, type VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStyle } from '../src/createStyle'

const theme: SmallTheme = createSmallTheme()
const combinations = createCombinations(48)
const LAYOUT_PROPS = new Set(['gap', 'direction', 'align', 'justify', 'wrap', 'padding'])
const TONES = ['a', 'b', 'c', 'd']

/** A fresh style object over a fresh in-memory cache, and the components over it. */
function createSetup() {
  const style = createStyle(theme, {
    prefix: 'b',
    cache: createCache({ prefix: 'b', sheet: createMemorySheet(), hasDevChecks: false }),
  })
  const { styled, StyleSheet } = style
  const Fixed = styled('div', { name: 'Fixed' })({ display: 'flex', padding: 8, color: 'red' })
  const Themed = styled('div', { name: 'Themed' })(({ theme: view }) => ({
    color: view.palette.primary,
    padding: view.space[2],
    borderRadius: view.radii.md,
  }))
  const Flex = styled('div', {
    name: 'Flex',
    shouldForwardProp: (prop) => !LAYOUT_PROPS.has(prop),
  })(LAYOUT_FIXED, (props) => createLayoutStyle(props as unknown as LayoutProps))
  const Cell = styled('span', { name: 'Cell', shouldForwardProp: (prop) => prop !== 'tone' })(
    ({ theme: view }) => ({ color: view.palette.text, padding: view.space[1] }),
    ({ tone }) => ({ opacity: (TONES.indexOf(tone as string) + 1) / 4 })
  )
  const sheet = StyleSheet.create({
    root: { margin: 4, outline: '1px solid blue' },
    other: { margin: 8 },
  })
  return { style, Fixed, Themed, Flex, Cell, sheet }
}
type Setup = ReturnType<typeof createSetup>

const kinds = ['fixed', 'themed', 'flex', 'override', 'entry'] as const
const labels: Record<(typeof kinds)[number], string> = {
  fixed: 'fixed styles only',
  themed: 'a function of the theme only',
  flex: 'prop-driven, 48 combinations',
  override: 'an override through style',
  entry: 'a single sheet entry in style',
}

/** The 48 virtual nodes of one kind of component. */
function createFortyEight(setup: Setup, kind: (typeof kinds)[number]): VNode[] {
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

/** The tree of 500 styled elements: 100 rows, each a `Flex` with four `Cell`s. */
function createTree(setup: Setup): VNode[] {
  const { Flex, Cell } = setup
  return Array.from({ length: 100 }, (_, row) =>
    h(Flex, { ...combinations[row % combinations.length] }, () =>
      Array.from({ length: 4 }, (_, cell) => h(Cell, { tone: TONES[cell] }, () => String(row)))
    )
  )
}

/** The app of three providers, one in the other, over 48 themed elements. */
function createNestedApp(setup: Setup) {
  const { ThemeProvider } = setup.style
  return createSSRApp(() =>
    h(ThemeProvider, { theme }, () =>
      h(ThemeProvider, { theme: { palette: { primary: '#d1531b' } } }, () =>
        h(ThemeProvider, { theme: { palette: { primary: '#123456' } } }, () =>
          createFortyEight(setup, 'themed')
        )
      )
    )
  )
}

/** The operation: a server render of the nested providers, made over a fresh setup and warmed once. */
async function prepareNested(): Promise<() => Promise<string>> {
  const setup = createSetup()
  const run = () => renderToString(createNestedApp(setup))
  await run()
  return run
}

/** The operation: a server app that renders `children` inside a provider, made over a fresh setup and warmed once. */
async function prepare(children: (setup: Setup) => VNode[]): Promise<() => Promise<string>> {
  const setup = createSetup()
  const run = () =>
    renderToString(
      createSSRApp(() => h(setup.style.ThemeProvider, { theme }, () => children(setup)))
    )
  await run()
  return run
}

it('vue: render to string, 48 elements', async (context) => {
  const cases = await Promise.all(
    kinds.map(async (kind) => ({
      name: `48 elements, ${labels[kind]}`,
      fn: await prepare((setup) => createFortyEight(setup, kind)),
    }))
  )
  await runGroup(context, '48 elements', cases, 3)
})

it('vue: render to string, the tree of 500', async (context) => {
  await runGroup(
    context,
    'tree',
    [
      { name: 'tree of 500 elements, server render to a string', fn: await prepare(createTree) },
      {
        name: 'nested providers three deep, 48 themed elements',
        fn: await prepareNested(),
      },
    ],
    3
  )
})
