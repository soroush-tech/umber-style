// What one operation is, in this file: the markup of a server render of the tree of 500 styled elements
// inside a provider is set as the content of a new container in a document of jsdom, a server app
// (`createSSRApp`) mounted on it hydrates it, and the app is unmounted and the container removed. Built Vue
// binding, production Vue; the engine writes into an in-memory sheet.
//   fresh engine   a fresh engine and cache for each operation: the classes are made during hydration.
//   warm engine    the one engine of the case, which made every class already.
//   no hydration   the markup set and the container removed, with no app: the part of the two cases above
//                  that is not hydration.
// jsdom is not a browser: it computes no layout and paints nothing.
// First: the document must exist before fixtures.ts loads Vue.
import { document } from './dom'
import type { BenchConfig } from '@soroush.tech/bench'
import { createRequire } from 'node:module'
import type * as Vue from 'vue'
import type * as ServerRenderer from 'vue/server-renderer'
import { createSmallTheme } from '../../../bench/src/themes'
import { createSetup, createTree, type Setup } from './fixtures'

const load = createRequire(import.meta.url)
const { createApp, createSSRApp, h } = load('vue') as typeof Vue
const { renderToString } = load('vue/server-renderer') as typeof ServerRenderer

const theme = createSmallTheme()

/** The root component of the tree over `setup`. */
const createRoot = (setup: Setup) => ({
  render: () => h(setup.style.ThemeProvider, { theme }, () => createTree(setup)),
})

const markup = await renderToString(createSSRApp(createRoot(createSetup())))

const warm = createSetup()
const warmContainer = document.createElement('div')
const warmApp = createApp(createRoot(warm))
warmApp.mount(warmContainer)
warmApp.unmount()

/** A new container with the server's markup in it. */
function createContainer(): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = markup
  document.body.append(container)
  return container
}

/** One hydration of the markup with the components of `setup`, then the app and its container ended. */
function hydrate(setup: Setup): void {
  const container = createContainer()
  const app = createSSRApp(createRoot(setup))
  app.mount(container)
  app.unmount()
  container.remove()
}

export default {
  name: 'vue: hydrate the tree of 500',
  cases: {
    'tree of 500: hydration, a fresh engine': () => hydrate(createSetup()),
    'tree of 500: hydration, a warm engine': () => hydrate(warm),
    'the markup set and removed, no hydration (the setup of the cases above)': () =>
      createContainer().remove(),
  },
} satisfies BenchConfig
