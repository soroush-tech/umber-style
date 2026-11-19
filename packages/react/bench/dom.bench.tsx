// @vitest-environment jsdom
// What one operation is, in this file: one synchronous render into jsdom (`flushSync` around
// `root.render` or `hydrateRoot`), so the time includes React's render and commit, the work of the
// engine, and jsdom's DOM operations (which are not a browser's: they set the figure's floor, and they
// are why the engine's own share is read best against the "same props" case). The engine writes into
// an in-memory sheet, never jsdom's style sheet. The tree is 500 styled elements: 100 rows of `Flex`
// with four `Cell`s each.
//   first render        a fresh engine, cache and root for each operation (made before it, not timed): the
//                       classes are made during the render, so this is the cold cost.
//   same props          the root already shows the tree; an element with the same props is rendered into
//                       it, so React renders all 500 again and finds nothing to change in the DOM.
//   changed props       the same, with the props of every element moved on, alternating between two
//                       settings that are both warm: classes are found, and most of the 500 elements
//                       get another class attribute.
//   provider            the children are one element made once, so React only re-renders what reads the
//                       context. "Same theme" re-renders the provider with its theme object again;
//                       "theme change" alternates two theme objects, which re-renders the 500.
//   hydration           markup made by a server render of the tree is set as the container's content,
//                       and `hydrateRoot` takes it over. "Cold engine": a fresh engine for each
//                       operation; "warm engine": the one engine of the case.
import { flushSync } from 'react-dom'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { runGroup } from '@umber-bench/shared/harness'
import { createApp, createSetup, mount, render, type Setup } from './domHelpers'
import { otherTheme, theme, Tree } from './fixtures'

it('render into the DOM: the tree of 500', async (context) => {
  // First render: made before each operation, ended after it.
  let first: { setup: Setup; mounted: ReturnType<typeof mount> }
  // Same props, and changed props: one root each, rendered once before the measurement.
  const same = createSetup()
  const sameMounted = mount()
  render(sameMounted.root, createApp(same, 0))

  const changed = createSetup()
  const changedMounted = mount()
  render(changedMounted.root, createApp(changed, 0))
  render(changedMounted.root, createApp(changed, 1))
  let shift = 0

  // Provider: the children are made once.
  const themed = createSetup()
  const themedMounted = mount()
  const children = <Tree components={themed.components} />
  const alternate = [theme, otherTheme]
  let turn = 0
  render(
    themedMounted.root,
    <themed.style.ThemeProvider theme={theme}>{children}</themed.style.ThemeProvider>
  )
  render(
    themedMounted.root,
    <themed.style.ThemeProvider theme={otherTheme}>{children}</themed.style.ThemeProvider>
  )

  await runGroup(
    context,
    'render into the DOM',
    [
      {
        name: 'tree of 500: first render',
        beforeEach: () => {
          first = { setup: createSetup(), mounted: mount() }
        },
        fn: () => render(first.mounted.root, createApp(first.setup, 0)),
        afterEach: () => first.mounted.unmount(),
      },
      {
        name: 'tree of 500: re-render with the same props',
        fn: () => render(sameMounted.root, createApp(same, 0)),
      },
      {
        name: 'tree of 500: re-render with changed props',
        fn: () => render(changedMounted.root, createApp(changed, (shift = 1 - shift))),
      },
      {
        name: 'tree of 500: provider re-rendered with the same theme',
        fn: () =>
          render(
            themedMounted.root,
            <themed.style.ThemeProvider theme={theme}>{children}</themed.style.ThemeProvider>
          ),
      },
      {
        name: 'tree of 500: provider theme change',
        fn: () =>
          render(
            themedMounted.root,
            <themed.style.ThemeProvider theme={alternate[(turn = 1 - turn)]}>
              {children}
            </themed.style.ThemeProvider>
          ),
      },
    ],
    3
  )
  for (const mounted of [sameMounted, changedMounted, themedMounted]) mounted.unmount()
})

it('hydrate the tree of 500', async (context) => {
  const server = createSetup()
  const markup = renderToString(createApp(server, 0))
  const warm = createSetup()
  let current: { setup: Setup; container: HTMLElement; root?: Root }
  const start = (setup: Setup) => {
    const container = document.createElement('div')
    container.innerHTML = markup
    document.body.append(container)
    current = { setup, container }
  }
  const hydrate = () => {
    flushSync(() => {
      current.root = hydrateRoot(current.container, createApp(current.setup, 0))
    })
  }
  const end = () => {
    flushSync(() => current.root?.unmount())
    current.container.remove()
  }
  // The warm engine has made every class already.
  const warmMount = mount()
  render(warmMount.root, createApp(warm, 0))
  warmMount.unmount()
  await runGroup(
    context,
    'hydrate',
    [
      {
        name: 'tree of 500: server render to a string',
        fn: () => renderToString(createApp(server, 0)),
      },
      {
        name: 'tree of 500: hydration, cold engine',
        beforeEach: () => start(createSetup()),
        fn: hydrate,
        afterEach: end,
      },
      {
        name: 'tree of 500: hydration, warm engine',
        beforeEach: () => start(warm),
        fn: hydrate,
        afterEach: end,
      },
    ],
    3
  )
})
