// What one operation is, in this file: one `renderToString` of an element made once before the cases,
// with the client build of the binding and production React, over a cache that a render before the
// measurement made warm, with the memo of contents off (the default) and on (`hasStyleMemo`), side by
// side. Every element's props class is a style function's result, a new object on each render.
//   2 combinations    48 elements of a component whose style is `{ fontSize: isMobile ? 12 : 48 }`,
//                     half of them `isMobile`
//   48 combinations   48 elements of the prop-driven layout component, each a distinct combination
//   tree of 500       a provider around the tree of 500: 100 prop-driven rows, each with four cells
//                     whose style is a function of one prop
// Each case has an engine and a cache of its own, with an in-memory sheet.
import type { BenchConfig } from '@soroush.tech/bench'
import type * as Core from '@umber-style/core'
import { createRequire } from 'node:module'
import type * as React from 'react'
import { binding, fixtures, renderToString } from './client'
import { createComponents, theme } from './fixtures'

const load = createRequire(import.meta.url)
const core = load('../../core/dist/index.cjs') as typeof Core
const { createElement: h } = load('react') as typeof React
const { createFortyEight, provide, createTreeApp } = fixtures

/** A fresh style object over a cache with the memo `hasStyleMemo`. */
function createSetup(hasStyleMemo: boolean) {
  const cache = core.createCache({
    prefix: 'b',
    sheet: core.createMemorySheet(),
    hasDevChecks: false,
    hasStyleMemo,
  })
  return binding.createStyle(theme, { prefix: 'b', cache })
}

/** The operation for `element`, after one render that makes the cache warm. */
function prepare(element: ReturnType<typeof provide>): () => string {
  renderToString(element)
  return () => renderToString(element)
}

/** 48 elements of a component that chooses between two styles by one prop. */
function createTwoCombinations(style: ReturnType<typeof createSetup>) {
  const Text = style.styled('div', {
    name: 'Text',
    shouldForwardProp: (prop) => prop !== 'isMobile',
  })<{ isMobile: boolean }>(({ isMobile }) => ({ fontSize: isMobile ? 12 : 48 }))
  return provide(
    style,
    Array.from({ length: 48 }, (_, index) => h(Text, { key: index, isMobile: index % 2 === 0 }))
  )
}

/** The cases of one state of the option. */
function createCases(hasStyleMemo: boolean, state: string) {
  const two = createSetup(hasStyleMemo)
  const many = createSetup(hasStyleMemo)
  const tree = createSetup(hasStyleMemo)
  return {
    [`48 elements, prop-driven, 2 combinations, ${state}`]: prepare(createTwoCombinations(two)),
    [`48 elements, prop-driven, 48 combinations, ${state}`]: prepare(
      provide(many, createFortyEight(createComponents(many), 'flex'))
    ),
    [`tree of 500 elements, prop-driven rows, ${state}`]: prepare(
      createTreeApp(tree, createComponents(tree))
    ),
  }
}

export default {
  name: 'react: render to string, prop-driven elements, the memo of contents',
  cases: { ...createCases(false, 'memo off'), ...createCases(true, 'memo on') },
} satisfies BenchConfig
