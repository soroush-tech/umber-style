// What one operation is, in this file: one synchronous render of the tree of 500 styled elements (100
// rows of `Flex` with four `Cell`s) into a document of jsdom, with the client build of the binding and
// production React: `flushSync` around `root.render`, so the time holds React's render and commit, the
// engine's work and jsdom's DOM operations (which are not a browser's). The engine writes into an
// in-memory sheet, never jsdom's style sheet.
//   first render    a fresh engine, cache and root, the tree rendered into it, and the root unmounted: the
//                   classes are made during the render. The second case is that setup and unmount with
//                   nothing rendered, to tell the render apart.
//   same props      the root shows the tree; an element with the same props is rendered into it, so React
//                   renders all 500 again and finds nothing to change in the DOM.
//   changed props   the same with the props of every element moved on, between two settings that are both
//                   warm: classes are found, and most of the 500 elements get another class attribute.
//   provider        the children are one element made once, so React renders again only what reads the
//                   theme. "The same theme" renders the provider again with its theme object; "a theme
//                   change" alternates two themes. The 500 read the theme through variables, so the outermost
//                   provider declares the other theme's values on the root and the elements are not
//                   rendered again: the figure is far below a render of the tree, and that is the point.
import type { BenchConfig } from '@soroush.tech/bench'
import { createElement, createSetup, fixtures, mount, render } from './dom'
import { otherTheme, theme } from './fixtures'

const { createTreeApp, provide, Tree } = fixtures

const same = createSetup()
const sameRoot = mount().root
render(sameRoot, createTreeApp(same.style, same.components, 0))

const changed = createSetup()
const changedRoot = mount().root
render(changedRoot, createTreeApp(changed.style, changed.components, 0))
render(changedRoot, createTreeApp(changed.style, changed.components, 1))
let shift = 0

const themed = createSetup()
const themedRoot = mount().root
// The children, made once: a render of the provider alone leaves them as they are.
const tree = createElement(Tree, { components: themed.components })
const themes = [theme, otherTheme]
let turn = 0
render(themedRoot, provide(themed.style, tree, otherTheme))
render(themedRoot, provide(themed.style, tree, theme))

export default {
  name: 'react: render the tree of 500 into the DOM',
  cases: {
    'tree of 500: first render, a fresh engine and root, then unmount': () => {
      const setup = createSetup()
      const mounted = mount()
      render(mounted.root, createTreeApp(setup.style, setup.components))
      mounted.unmount()
    },
    'a fresh engine and root, unmounted with nothing rendered (the setup of the case above)':
      () => {
        createSetup()
        mount().unmount()
      },
    'tree of 500: re-render with the same props': () =>
      render(sameRoot, createTreeApp(same.style, same.components, 0)),
    'tree of 500: re-render with changed props': () => {
      shift = 1 - shift
      render(changedRoot, createTreeApp(changed.style, changed.components, shift))
    },
    'tree of 500: provider rendered again with the same theme': () =>
      render(themedRoot, provide(themed.style, tree, theme)),
    'tree of 500: a theme change through the provider': () => {
      turn = 1 - turn
      render(themedRoot, provide(themed.style, tree, themes[turn]))
    },
  },
} satisfies BenchConfig
