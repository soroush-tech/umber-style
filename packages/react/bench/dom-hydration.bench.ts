// What one operation is, in this file: the markup of a server render of the tree of 500 styled elements
// is set as the content of a new container in a document of jsdom, `hydrateRoot` takes it over inside
// `flushSync`, and the root is unmounted and the container removed. Client build of the binding,
// production React; the engine writes into an in-memory sheet.
//   fresh engine   a fresh engine and cache for each operation: the classes are made during hydration,
//                  as on a page's first load.
//   warm engine    the one engine of the case, which made every class already.
//   no hydration   the markup set and the container removed, with no root: the part of the two cases above
//                  that is not hydration.
// The markup was rendered in this process, where there is a document, so it holds no style elements, as
// the first HTML of a page whose styles are in its head does not. jsdom is not a browser: it computes no
// layout and paints nothing.
import type { BenchConfig } from '@soroush.tech/bench'
import type { Root } from 'react-dom/client'
import {
  createSetup,
  document,
  fixtures,
  flushSync,
  hydrateRoot,
  mount,
  render,
  renderToString,
  type Setup,
} from './dom'

const { createTreeApp } = fixtures

const server = createSetup()
const markup = renderToString(createTreeApp(server.style, server.components))

const warm = createSetup()
const warmed = mount()
render(warmed.root, createTreeApp(warm.style, warm.components))
warmed.unmount()

/** A new container with the server's markup in it. */
function createContainer(): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = markup
  document.body.append(container)
  return container
}

/** One hydration of the markup with the components of `setup`, then the root and its container ended. */
function hydrate(setup: Setup): void {
  const container = createContainer()
  let root: Root | undefined
  flushSync(() => {
    root = hydrateRoot(container, createTreeApp(setup.style, setup.components))
  })
  flushSync(() => root?.unmount())
  container.remove()
}

export default {
  name: 'react: hydrate the tree of 500',
  cases: {
    'tree of 500: hydration, a fresh engine': () => hydrate(createSetup()),
    'tree of 500: hydration, a warm engine': () => hydrate(warm),
    'the markup set and removed, no hydration (the setup of the cases above)': () =>
      createContainer().remove(),
  },
} satisfies BenchConfig
