// What one operation is, in this file, with the React Native binding over the stand-in platform module
// that its tests use (`vitest.react-native.ts`: a `StyleSheet.create` that records its input, which
// is a mock function, so each registration is also counted by the mock):
//   48 elements   one `renderToString` of a provider with 48 elements of one styled component, whose
//                 base component is a stand-in view that renders an empty element with its children. This is the cost of
//                 resolving the styles of 48 elements (and of React), not of a native view. `flex` is
//                 the prop-driven component, one of 48 combinations for each element.
//   tree          the same around the tree of 500 styled elements: 100 rows of `Flex` with four `Cell`s.
//   sheet         one `sheet.resolve(theme)` of a sheet made from a function of the theme. "A new theme"
//                 walks a pool of theme objects, so the function runs and its entries are registered with
//                 the platform; the sheet is made again each time the pool comes round (one sheet for
//                 each 500 operations is part of the figure). "The same theme" is the WeakMap hit.
//                 "Object sheet" is one read of an entry of a sheet given as an object.
// The platform's own cost (native view creation, style registration across the bridge) is not here.
import { runGroup } from '@umber-bench/shared/harness'
import {
  createCombinations,
  createLayoutStyle,
  LAYOUT_FIXED,
  type LayoutProps,
} from '@umber-bench/shared/styles'
import { cloneTheme, createSmallTheme, type SmallTheme } from '@umber-bench/shared/themes'
import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { StyleSheet as platform } from 'react-native'
import { vi } from 'vitest'
import { createStyle } from '../src/createStyle'
import type { NativeStyleObject } from '../src/nativeStyle'

const theme: SmallTheme = createSmallTheme()
const combinations = createCombinations(48)
const LAYOUT_PROPS = new Set(['gap', 'direction', 'align', 'justify', 'wrap', 'padding'])
const TONES = ['a', 'b', 'c', 'd']

/** Forgets what the stand-in recorded, so that its log does not grow with the operations (not timed). */
const clearPlatform = () => {
  vi.mocked(platform.create).mockClear()
}

/** A stand-in for a native view: it renders an empty element around its children and drops the rest. */
const View = ({ children }: { children?: ReactNode }) => createElement('view', null, children)

/** The components over a fresh style object. */
function createSetup() {
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
  const Cell = styled(View, { shouldForwardProp: (prop) => prop !== 'tone' })<{ tone: string }>(
    ({ theme: view }) => ({ backgroundColor: view.palette.text, padding: view.space[1] }),
    ({ tone }) => ({ opacity: (TONES.indexOf(tone) + 1) / 4 })
  )
  const sheet = StyleSheet.create({ root: { margin: 4 }, other: { margin: 8 } })
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

/** A key that tells the combination of props apart: the 48 are distinct. */
const keyOf = ({ gap, direction, align, justify, wrap }: LayoutProps): string =>
  [gap, direction, align, justify, wrap].join('|')

function createFortyEight(setup: Setup, kind: (typeof kinds)[number]): ReactNode[] {
  const { Fixed, Themed, Flex, sheet } = setup
  return combinations.map((props) => {
    const key = keyOf(props)
    switch (kind) {
      case 'fixed':
        return <Fixed key={key} />
      case 'themed':
        return <Themed key={key} />
      case 'flex':
        return <Flex key={key} {...props} />
      case 'override':
        return <Fixed key={key} style={{ margin: 4 }} />
      case 'entry':
        return <Fixed key={key} style={sheet.root} />
    }
  })
}

function createTree({ Flex, Cell }: Setup): ReactNode[] {
  return Array.from({ length: 100 }, (_, row) => (
    <Flex key={row} {...combinations[row % combinations.length]}>
      {Array.from({ length: 4 }, (_, cell) => (
        <Cell key={cell} tone={TONES[cell]}>
          {row}
        </Cell>
      ))}
    </Flex>
  ))
}

/** The operation: a render of `children` inside a provider, over a fresh setup. */
function prepare(children: (setup: Setup) => ReactNode): () => string {
  const setup = createSetup()
  const element = (
    <setup.style.ThemeProvider theme={theme}>{children(setup)}</setup.style.ThemeProvider>
  )
  renderToString(element)
  return () => renderToString(element)
}

it('react native: resolve the styles of 48 elements and of the tree', async (context) => {
  await runGroup(context, '48 elements and the tree', [
    ...kinds.map((kind) => ({
      name: `48 elements, ${labels[kind]}`,
      fn: prepare((setup) => createFortyEight(setup, kind)),
      afterEach: () => clearPlatform(),
    })),
    {
      name: 'tree of 500 elements, render to a string',
      fn: prepare((setup) => createTree(setup)),
      afterEach: () => clearPlatform(),
    },
  ])
})

it('react native: sheets', async (context) => {
  const { style } = createSetup()
  const views = Array.from({ length: 500 }, () => cloneTheme(theme))
  const create = () =>
    style.StyleSheet.create((value: SmallTheme) => ({
      root: { padding: value.space[2], backgroundColor: value.palette.text },
      title: { fontSize: value.fontSizes.lg, fontWeight: '700' as const },
      body: { fontSize: value.fontSizes.md, color: value.palette.text },
      footer: { marginTop: value.space[4] },
      icon: { width: value.space[4], height: value.space[4], borderRadius: value.radii.sm },
    })) as unknown as { resolve(value: SmallTheme): unknown }
  let themed = create()
  let index = 0
  const same = create()
  same.resolve(views[0])
  const objectSheet = style.StyleSheet.create({ root: { margin: 4 }, other: { margin: 8 } })
  await runGroup(context, 'sheets', [
    {
      name: 'function sheet, resolved for a new theme',
      fn: () => {
        if (index === views.length) {
          themed = create()
          index = 0
        }
        return themed.resolve(views[index++])
      },
      afterEach: () => clearPlatform(),
    },
    { name: 'function sheet, resolved for the same theme again', fn: () => same.resolve(views[0]) },
    { name: 'object sheet, a later access of an entry', fn: () => objectSheet.root },
  ])
})
