// @vitest-environment jsdom
// What one operation is, in this file: each of the options of the engine switched on and then off
// (`hasLayers`, `hasBaseClass`, `hasPruning`, `hasLabels`, `hasColorFallbacks`, `hasScope`,
// `hasDevChecks`), for the same three cases, so that a group's six rows compare like with like. All the
// other options are at their defaults. The prop-driven component here has a style that applies only
// inside another theme (a `when()` key), so that `hasScope` has something to change in it.
//   cold 48    one `renderToString` of a provider with 48 elements of the prop-driven component
//              (`Flex`, one of 48 combinations each), with a fresh engine and cache for each operation
//              (made before it, not timed): every class is made during the render.
//   warm 48    the same render over a cache that already holds the classes: only what the option does
//              on the way to a class that exists shows.
//   tree       a first render of the tree of 500 styled elements into jsdom, with a fresh engine for each
//              operation, as `dom.bench.tsx` does.
// The engine writes into an in-memory sheet. `hasDevChecks` schedules a check of the page for a quarter
// of a second after the last rule; the check runs from a timer, which a synchronous operation never
// lets fire, so its cost is not in these figures. One pass of the check is measured on its own in the
// core package (`startup.bench.ts`, "dev checks").
import { renderToString } from 'react-dom/server'
import { runGroup, type BenchCase } from '@umber-bench/shared/harness'
import type { CacheOptions } from '@umber-style/core'
import type { ReactElement } from 'react'
import { createApp, createSetup, mount, render, type Setup } from './domHelpers'
import { createFortyEight, theme } from './fixtures'

const OPTIONS = [
  'hasLayers',
  'hasBaseClass',
  'hasPruning',
  'hasLabels',
  'hasColorFallbacks',
  'hasScope',
  'hasDevChecks',
] as const

const createFlexElement = (setup: Setup): ReactElement => (
  <setup.style.ThemeProvider theme={theme}>
    {createFortyEight(setup.components, 'flex')}
  </setup.style.ThemeProvider>
)

/** The three cases of one option set to `value`. */
function createCases(option: (typeof OPTIONS)[number], value: boolean): BenchCase[] {
  const label = `${option} ${value ? 'on' : 'off'}`
  const options: CacheOptions = { [option]: value }
  let cold: Setup
  let element: ReactElement
  const warm = createSetup(options, true)
  const warmElement = createFlexElement(warm)
  renderToString(warmElement)
  let tree: { setup: Setup; mounted: ReturnType<typeof mount> }
  return [
    {
      name: `${label}: 48 combinations, cold`,
      beforeEach: () => {
        cold = createSetup(options, true)
        element = createFlexElement(cold)
      },
      fn: () => renderToString(element),
    },
    { name: `${label}: 48 combinations, warm`, fn: () => renderToString(warmElement) },
    {
      name: `${label}: tree of 500, first render`,
      beforeEach: () => {
        tree = { setup: createSetup(options, true), mounted: mount() }
      },
      fn: () => render(tree.mounted.root, createApp(tree.setup, 0)),
      afterEach: () => tree.mounted.unmount(),
    },
  ]
}

for (const option of OPTIONS) {
  it(`option ${option}`, async (context) => {
    // Four times the usual time: the two settings of an option differ by less than the noise of a short run.
    await runGroup(
      context,
      option,
      [...createCases(option, true), ...createCases(option, false)],
      4
    )
  })
}
