import { createCache, createMemorySheet } from './cache'
import { createLazyEngine } from './createEngine'

const format = (value: number) => `${value}px`
const theme = {
  palette: { primary: '#0000ff', text: '#111111' },
  space: [0, 4, 8],
  radii: { md: 6 },
  breakpoints: { md: 900 },
  components: { button: { minWidth: 64 } },
  format,
}
type PageTheme = typeof theme

/** An engine as `configure` makes it (no base theme given), over a memory sheet of its own. */
function setup() {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 's', sheet, hasDevChecks: false })
  const engine = createLazyEngine<PageTheme>({ prefix: 's', cache, hasValueRepair: true })
  return { engine, cache, sheet }
}

/**
 * What an engine writes and returns for two renders of a provider: `first` in the first, `second` in the
 * second (its root rule and its view each time), and a class that reads every token.
 */
function renderTwice(first: PageTheme, second: PageTheme) {
  const { engine, cache, sheet } = setup()
  const results = [first, second].map((each) => {
    const id = engine.declareRoot(each, 'light')
    const view = engine.createThemeView(each)
    const className = engine.css({
      color: view.palette.primary,
      borderColor: view.palette.text,
      padding: `${view.space[1]} ${view.space[2]}`,
      borderRadius: view.radii.md,
    })
    return { id, view, className, full: cache.getFullRules(id) }
  })
  return { results, css: sheet.rules.join(''), extracted: cache.extract() }
}

/** A copy of `theme` at every depth, with the same function. */
const deepCopy = (value: PageTheme): PageTheme => ({
  ...structuredClone({ ...value, format: undefined }),
  format: value.format,
})

describe('a theme of the same contents in a new object', () => {
  const reference = renderTwice(theme, theme)

  it.each([
    ['the same object', theme],
    ['a shallow copy', { ...theme }],
    ['a deep copy', deepCopy(theme)],
  ])('writes and returns what the same object does, given as %s', (_label, second) => {
    const { results, css, extracted } = renderTwice(theme, second)
    expect(css).toBe(reference.css)
    expect(extracted).toEqual(reference.extracted)
    expect(results.map(({ id, className, full }) => ({ id, className, full }))).toEqual(
      reference.results.map(({ id, className, full }) => ({ id, className, full }))
    )
    // The view is the one of the first theme: a component that reads it does not render again.
    expect(results[1].view).toBe(results[0].view)
  })

  it('is not taken for a copy with one value changed', () => {
    const changed = { ...theme, palette: { ...theme.palette, primary: '#ff0000' } }
    const { results, css } = renderTwice(theme, changed)
    expect(results[1].id).not.toBe(results[0].id)
    expect(results[1].full.join('')).toContain('--s-palette-primary:#ff0000;')
    expect(css).toContain('--s-palette-primary:#ff0000;')
    // Only the value of a variable changed: the view is the same, as it was before.
    expect(results[1].view).toBe(results[0].view)
    const { results: raw } = renderTwice(theme, { ...theme, breakpoints: { md: 1024 } })
    expect(raw[1].id).toBe(raw[0].id)
    expect(raw[1].view).not.toBe(raw[0].view)
    expect(raw[1].view.breakpoints.md).toBe(1024)
  })

  it('is not taken for a copy with another function under a raw key', () => {
    const { results } = renderTwice(theme, { ...theme, format: (value: number) => `${value}em` })
    expect(results[1].view).not.toBe(results[0].view)
  })

  it('makes the view again, as before, once the view of a theme seen is no longer recent', () => {
    const { engine } = setup()
    const first = engine.createThemeView(theme)
    // Another theme whose view is the same: only the value of a variable differs.
    const light = { ...theme, palette: { ...theme.palette, primary: '#ff0000' } }
    expect(engine.createThemeView(light)).toBe(first)
    // Eight views that differ, with a copy of `light` between them, which keeps it among the themes seen.
    for (let index = 0; index < 8; index++) {
      engine.createThemeView({ ...theme, breakpoints: { md: index } })
      engine.createThemeView({ ...light })
    }
    // The view of `light` is no longer one of the last eight: a copy gets a view made again.
    const again = engine.createThemeView({ ...light })
    expect(again).not.toBe(first)
    expect(again).toEqual(first)
    expect(engine.createThemeView(light)).toBe(first)
  })
})
