import { createApp, h, type Component } from 'vue'

// Two copies of the binding, each with its own copy of the core, and one Vue: as an app has them when one
// package is bundled into a build and another is left external.

/** A copy of the binding (and of the core under it), with module state of its own. */
async function loadCopy() {
  vi.resetModules()
  return import('./index')
}

const theme = { palette: { primary: '#0000ff' } }

function mount(component: Component) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  createApp(component).mount(element)
  return element
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('two copies of the Vue binding', () => {
  it('share one default style, and so its engine and its provider', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second.styled).toBe(first.styled)
    expect(second.ThemeProvider).toBe(first.ThemeProvider)
    expect(second.getEngine()).toBe(first.getEngine())
  })

  it('share the cache provider: a component of one writes into the cache that a provider of the other gives', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    const { createCache, createMemorySheet } = await import('@umber-style/core')
    const cache = createCache({ prefix: 'given', hasLayers: false, sheet: createMemorySheet() })
    const Box = second.createStyle(theme, { prefix: 'own' }).styled('p')({ margin: 0 })
    const element = mount({ render: () => h(first.CacheProvider, { value: cache }, () => h(Box)) })
    const className = element.querySelector('p')?.className as string
    expect(className).toMatch(/^given-/)
    expect(cache.extract().css).toBe(`.${className}{margin:0;}`)
  })
})
