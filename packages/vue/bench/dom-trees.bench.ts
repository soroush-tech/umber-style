// What one operation is, in this file: the tree of 500 styled elements (100 rows of `Flex` with four
// `Cell`s) inside a provider, in an app mounted into a document of jsdom, with the built Vue binding and
// production Vue. The engine writes into an in-memory sheet, never jsdom's style sheet. jsdom's DOM is not
// a browser's: it computes no layout and paints nothing.
//   first render    a fresh engine, cache and app, mounted with the tree (the classes are made during the
//                   render), then unmounted. The second case is that setup, mounted with nothing and
//                   unmounted, to tell the render apart.
//   same props      a value the root's render reads is changed and Vue's next tick awaited: the root renders
//                   again and the 500 get the same props.
//   changed props   the same, with the props of every element moved on, between two settings that are both
//                   warm: classes are found, and most of the 500 elements get another class.
//   theme change    the provider's theme alternates between two themes, and the next tick is awaited.
// First: the document must exist before fixtures.ts loads Vue.
import { document } from './dom'
import type { BenchConfig } from '@soroush.tech/bench'
import { createRequire } from 'node:module'
import type * as Vue from 'vue'
import { createSmallTheme } from '../../../bench/src/themes'
import { createSetup, createTree, type Setup } from './fixtures'

const { createApp, h, nextTick, shallowRef } = createRequire(import.meta.url)('vue') as typeof Vue

const theme = createSmallTheme()
const otherTheme = { palette: { primary: '#d1531b', text: '#222222' } }

/** An app that renders `render` into a new container, mounted, and what ends both. */
function mountApp(render: () => Vue.VNode | null) {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({ render })
  app.mount(container)
  return {
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

/** The tree with `shift` inside a provider of `value`. */
const provide = (setup: Setup, value: object, shift: number) =>
  h(setup.style.ThemeProvider, { theme: value }, () => createTree(setup, shift))

/** Reads `tick`, so that the render that calls it runs again when the value changes. */
const readTick = (tick: { readonly value: number }): number => tick.value

const same = createSetup()
const sameTick = shallowRef(0)
mountApp(() => {
  readTick(sameTick)
  return provide(same, theme, 0)
})

const changed = createSetup()
const shift = shallowRef(1)
mountApp(() => provide(changed, theme, shift.value))
shift.value = 0
await nextTick()

const themed = createSetup()
const current = shallowRef<object>(otherTheme)
mountApp(() => provide(themed, current.value, 0))
current.value = theme
await nextTick()

export default {
  name: 'vue: render the tree of 500 into the DOM',
  cases: {
    'tree of 500: first render, a fresh engine and app, then unmount': () => {
      const setup = createSetup()
      mountApp(() => provide(setup, theme, 0)).unmount()
    },
    'a fresh engine and app, unmounted with nothing rendered (the setup of the case above)': () => {
      createSetup()
      mountApp(() => null).unmount()
    },
    'tree of 500: re-render with the same props': () => {
      sameTick.value += 1
      return nextTick()
    },
    'tree of 500: re-render with changed props': () => {
      shift.value = 1 - shift.value
      return nextTick()
    },
    'tree of 500: a theme change through the provider': () => {
      current.value = current.value === theme ? otherTheme : theme
      return nextTick()
    },
  },
} satisfies BenchConfig
