import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** The app of the page: one component whose label has upper-case letters, one whose label has none. */
function createApp(options: { isServer: boolean }) {
  // The server writes to no page: its cache has a sheet in memory.
  const cache = options.isServer
    ? createCache({ prefix: 'hl', sheet: createMemorySheet() })
    : undefined
  const { styled, ThemeProvider } = createStyle(theme, { prefix: 'hl', cache })
  const Typography = styled('p', { label: 'Typography' })(({ theme: view }) => ({
    color: view.palette.primary,
  }))
  const Plain = styled('p', { label: 'plain' })({ margin: 3 })
  const App = (
    <ThemeProvider theme={theme} isRoot>
      <Typography data-testid="typography">a</Typography>
      <Plain data-testid="plain">b</Plain>
    </ThemeProvider>
  )
  return { App, css: () => cache?.extract().css ?? '' }
}

/** How many style rules under `list`, layers and groups included, have `selector` as their selector text. */
function countRules(list: CSSRuleList, selector: string): number {
  let count = 0
  for (const rule of list) {
    if (rule instanceof CSSStyleRule && rule.selectorText === selector) count++
    else if ('cssRules' in rule) count += countRules(rule.cssRules as CSSRuleList, selector)
  }
  return count
}

/** How many rules of all the style sheets of the page have `selector` as their selector text. */
function countInPage(selector: string): number {
  return [...document.styleSheets].reduce(
    (total, sheet) => total + countRules(sheet.cssRules, selector),
    0
  )
}

describe('a page rendered on the server and hydrated in a browser', () => {
  it('has the rule of each class once, with an upper-case letter in its label or not', async () => {
    const server = createApp({ isServer: true })
    const html = renderToString(server.App)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    // What the server sends in the head: the rules of the page in a style element of the engine's key.
    const element = document.createElement('style')
    element.setAttribute('data-precedence', 'hl')
    element.setAttribute('data-href', 'hl-page')
    element.textContent = server.css()
    document.head.appendChild(element)

    const { App } = createApp({ isServer: false })
    await act(async () => {
      hydrateRoot(container, App)
    })

    const names = ['typography', 'plain'].map(
      (id) => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).className
    )
    expect(names[0]).toMatch(/^hl-Typography-/)
    expect(names[1]).toMatch(/^hl-plain-/)
    expect(names.map((name) => countInPage(`.${name}`))).toEqual([1, 1])
  })
})
