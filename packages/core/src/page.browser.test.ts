import { createCache } from './cache'
import { createEngine } from './createEngine'
import { findMissingStyles } from './findMissingStyles'

let count = 0
const nextPrefix = () => `pg${++count}`

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

const light = { palette: { primary: '#0000ff', accent: '#00ff00' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#ff0000', accent: '#ffff00' } }

function addHoisted(prefix: string, css: string) {
  const element = document.createElement('style')
  element.dataset.precedence = prefix
  element.dataset.href = 'x'
  element.textContent = css
  document.head.appendChild(element)
}

describe('the page that a cache reads, in a real browser', () => {
  it('finds nothing missing in a styled page, and finds a class with no rule', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix })
    const root = engine.themeClass(light, 'light')
    const own = engine.cache.css({ color: engine.refs.palette.primary })
    document.body.innerHTML = `<div class="${root}"><p class="${own}"></p></div>`
    expect(findMissingStyles(document, { prefix })).toEqual([])
    document.body.innerHTML = `<div class="${root}"><p class="${own} ${prefix}-nothing"></p></div>`
    expect(findMissingStyles().map((problem) => problem.name)).toEqual([`${prefix}-nothing`])
  })

  it('reads a class with an upper-case label, and one that the browser writes with escapes', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix })
    const own = engine.cache.css({ label: 'View-Sidebar', display: 'flex' })
    expect(own).toMatch(/-View-Sidebar-/)
    addHoisted(prefix, String.raw`.${prefix}-md\:flex,.${prefix}-\49 cons{display:flex;}`)
    const rule = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).at(-1)
    // The browser keeps an escape in the text of the selector.
    expect((rule as CSSStyleRule).selectorText).toContain('\\')
    document.body.innerHTML = `<p class="${own} ${prefix}-md:flex ${prefix}-Icons"></p>`
    expect(findMissingStyles(document, { prefix })).toEqual([])
    document.body.innerHTML = `<p class="${own} ${prefix}-View-Sidebar-x"></p>`
    expect(findMissingStyles().map((problem) => problem.name)).toEqual([`${prefix}-View-Sidebar-x`])
  })

  it('finds a variable that the theme of the page does not give', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix })
    const own = engine.cache.css({ color: engine.refs.palette.primary })
    document.body.innerHTML = `<p class="${own}"></p>`
    expect(findMissingStyles().map((problem) => problem.name)).toEqual([
      `--${prefix}-palette-primary`,
    ])
  })

  it('completes the class of a theme the page offers with a variable that a hoisted rule brings later', async () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix })
    const darkClass = engine.themeClass(dark, 'dark')
    document.body.innerHTML = `<div class="${darkClass}"><p id="p" class="${prefix}-late"></p></div>`
    addHoisted(
      prefix,
      `@layer ${prefix}-components{.${prefix}-late{color:var(--${prefix}-palette-accent);}}`
    )
    await settle()
    expect(getComputedStyle(document.getElementById('p') as Element).color).toBe('rgb(255, 255, 0)')
    expect(findMissingStyles()).toEqual([])
  })

  it('reads a page of a few hundred rules at start-up in a few milliseconds', () => {
    const prefix = nextPrefix()
    const rules = Array.from(
      { length: 400 },
      (_, index) =>
        `@layer ${prefix}-components{.${prefix}-c${index}{color:var(--${prefix}-v${index % 20});padding:var(--${prefix}-space-2);}}`
    ).join('')
    addHoisted(prefix, rules)
    const start = performance.now()
    const cache = createCache({ prefix })
    const elapsed = performance.now() - start
    expect(cache.usedVariables.size).toBe(21)
    expect(cache.insertOnce(`${prefix}-c399`, ['a{}'])).toBe(false)
    expect(elapsed).toBeLessThan(50)
    console.info(`start-up scan of 400 rules: ${elapsed.toFixed(2)} ms`)
  })
})

describe('a props class is not shared between components, with no labels and no names', () => {
  it('keeps each props class after its own base class, whichever component is made first', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix, hasLabels: false })
    const props = ({ tone }: { tone?: string }) => ({
      color: tone ? 'rgb(0, 128, 0)' : 'rgb(0, 0, 0)',
    })
    const second = engine.createStyler({}, [{ color: 'rgb(1, 1, 1)', margin: 3 }, props])
    const first = engine.createStyler({}, [{ color: 'rgb(2, 2, 2)', padding: 5 }, props])
    const none = engine.createStyler({}, [props])
    const classes = [first, second, none].map((styler) => styler.getClassName({ tone: 'x' }))
    expect(new Set(classes.flatMap((names) => names.split(' '))).size).toBe(5)
    document.body.innerHTML = classes.map((names) => `<p class="${names}"></p>`).join('')
    for (const element of document.querySelectorAll('p')) {
      expect(getComputedStyle(element).color).toBe('rgb(0, 128, 0)')
    }
  })
})
