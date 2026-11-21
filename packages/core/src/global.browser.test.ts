import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { createStyleTag } from './extractStyles'
import { globalStyles } from './globalStyles'

let count = 0
const nextPrefix = () => `gl${++count}`

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.className = ''
})

const theme = { palette: { text: '#0000ff' } }

const colorOf = (element: Element) => getComputedStyle(element).color

describe('global rules in a real browser', () => {
  it('apply to body, lose to a component, and are gone after their release', () => {
    const prefix = nextPrefix()
    const engine = createEngine(theme, { prefix })
    document.documentElement.className = engine.themeClass(theme)
    document.body.innerHTML = '<p id="plain"></p><main><p id="styled"></p></main>'
    const plain = document.getElementById('plain') as Element
    const styled = document.getElementById('styled') as Element
    const before = colorOf(document.body)
    styled.className = engine.css({ color: 'rgb(0, 128, 0)' })
    const release = engine.insertGlobal(
      globalStyles((view: typeof theme) => ({
        body: { color: view.palette.text },
        // A more specific selector, written later: the components layer still wins.
        'html body main p#styled': { color: 'rgb(255, 0, 0)' },
      }))
    )
    expect(colorOf(document.body)).toBe('rgb(0, 0, 255)')
    expect(colorOf(plain)).toBe('rgb(0, 0, 255)')
    expect(colorOf(styled)).toBe('rgb(0, 128, 0)')
    release()
    expect(colorOf(document.body)).toBe(before)
    expect(colorOf(styled)).toBe('rgb(0, 128, 0)')
  })

  it('are taken over from a server page, not written again, and removed from it when released', () => {
    const prefix = nextPrefix()
    const styles = globalStyles({
      body: { color: 'rgb(1, 2, 3)' },
      '@media (min-width: 1px)': { body: { backgroundColor: 'rgb(4, 5, 6)' } },
    })
    const server = createEngine(theme, {
      prefix,
      cache: createCache({ prefix, sheet: createMemorySheet() }),
    })
    server.insertGlobal(styles)
    document.head.innerHTML = createStyleTag(server.cache)
    const element = document.head.querySelector('style') as HTMLStyleElement
    const engine = createEngine(theme, { prefix })
    const release = engine.insertGlobal(styles)
    expect(engine.cache.extract().css).toBe('')
    expect(colorOf(document.body)).toBe('rgb(1, 2, 3)')
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(4, 5, 6)')
    release()
    expect(colorOf(document.body)).not.toBe('rgb(1, 2, 3)')
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    // Only the layer order statement is left.
    expect((element.sheet as CSSStyleSheet).cssRules).toHaveLength(1)
  })
})
