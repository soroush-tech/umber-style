// What one operation is, in this file: one `renderToString` of an element made once before the
// cases, in Node, with the client build of the binding (so, where there is no `document`, the style
// elements of each class are rendered too, as a classic server render of a client component does).
//   48 elements   a provider with 48 elements of one component. The engine is warm: the classes were made
//                 by a render before the measurement, so this is the cost of resolving and rendering
//                 over a cache that hits. `flex` is the prop-driven component, one of 48 combinations
//                 for each element; `override` has a style object in `style` (merged into an override
//                 class), `entry` a single sheet entry (used directly, no merge).
//   nested        the same 48 themed elements inside three providers, each with its own partial theme.
//   tree          a provider around the tree of 500 styled elements, which makes its elements in the
//                 render (a row and four cells, 100 times).
// Each case has an engine and a cache of its own, with an in-memory sheet.
import { renderToString } from 'react-dom/server'
import { runGroup } from '@umber-bench/shared/harness'
import { createStyle } from '../src/createStyle'
import {
  createBenchOptions,
  createComponents,
  createFortyEight,
  otherTheme,
  theme,
  Tree,
} from './fixtures'

/** A fresh style object, the components over it, and a warm cache for `element`. */
function prepare(
  makeElement: (setup: ReturnType<typeof createSetup>) => React.ReactElement
): () => string {
  const setup = createSetup()
  const element = makeElement(setup)
  renderToString(element)
  return () => renderToString(element)
}

function createSetup(hasServerStyleElements = true) {
  const style = createStyle(theme, { ...createBenchOptions(), hasServerStyleElements })
  return { style, components: createComponents(style) }
}

const kinds = ['fixed', 'themed', 'flex', 'override', 'entry'] as const
const labels: Record<(typeof kinds)[number], string> = {
  fixed: 'fixed styles only',
  themed: 'a function of the theme only',
  flex: 'prop-driven, 48 combinations',
  override: 'an override through style',
  entry: 'a single sheet entry in style',
}

it('render to string: 48 elements', async (context) => {
  await runGroup(
    context,
    '48 elements',
    kinds.map((kind) => ({
      name: `48 elements, ${labels[kind]}`,
      fn: prepare(({ style, components }) => (
        <style.ThemeProvider theme={theme}>
          {createFortyEight(components, kind)}
        </style.ThemeProvider>
      )),
    }))
  )
})

it('render to string: nested providers and trees', async (context) => {
  const render = (hasServerStyleElements: boolean) => {
    const setup = createSetup(hasServerStyleElements)
    const element = (
      <setup.style.ThemeProvider theme={theme}>
        <Tree components={setup.components} />
      </setup.style.ThemeProvider>
    )
    renderToString(element)
    return () => renderToString(element)
  }
  await runGroup(context, 'nested providers and trees', [
    {
      name: 'nested providers three deep, 48 themed elements',
      fn: prepare(({ style, components }) => (
        <style.ThemeProvider theme={theme}>
          <style.ThemeProvider theme={otherTheme}>
            <style.ThemeProvider theme={{ palette: { primary: '#123456' } }}>
              {createFortyEight(components, 'themed')}
            </style.ThemeProvider>
          </style.ThemeProvider>
        </style.ThemeProvider>
      )),
    },
    { name: 'tree of 500 elements, server render to a string', fn: render(true) },
    {
      name: 'tree of 500 elements, server render without style elements',
      fn: render(false),
    },
  ])
})
