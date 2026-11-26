import { createCache, createMemorySheet } from './cache'
import { createThemeClass, createThemeId, declareRootTheme } from './theme'

const colorRule = '@property --u-a{syntax:"<color>";inherits:true;initial-value:#fff;}'

function setup() {
  return createCache({ prefix: 'u', sheet: createMemorySheet(), hasLayers: false })
}

describe('the full rules of an id, kept while the cache holds it', () => {
  it('gives the same list for a class while the cache holds it: its rules as written', () => {
    const cache = setup()
    const name = cache.css({ color: 'red' })
    expect(cache.getFullRules(name)).toBe(cache.getFullRules(name))
    expect(cache.getFullRules(name)).toBe(cache.getRules(name))
    expect(cache.getFullRules(name)).toEqual([`.${name}{color:red;}`])
  })

  it('gives the same list for a theme class and a root theme, and makes it again when the @property rules change', () => {
    const cache = setup()
    cache.registerProperties({ '--u-a': colorRule })
    const themeClass = createThemeClass(cache, { '--u-a': '#000', '--u-z': '1' })
    const root = declareRootTheme(cache, { '--u-a': '#111' })
    const themeRules = cache.getFullRules(themeClass)
    const rootRules = cache.getFullRules(root)
    expect(cache.getFullRules(themeClass)).toBe(themeRules)
    expect(cache.getFullRules(root)).toBe(rootRules)
    expect(themeRules).toEqual([colorRule, `.${themeClass}{--u-a:#000;--u-z:1;}`])
    expect(rootRules).toEqual([colorRule, ':where(:root){--u-a:#111;}'])
    cache.registerProperties({})
    expect(cache.getFullRules(themeClass)).toEqual([`.${themeClass}{--u-a:#000;--u-z:1;}`])
    expect(cache.getFullRules(root)).toEqual([':where(:root){--u-a:#111;}'])
  })

  it('gives a new list for a held class that was let go and written again', async () => {
    vi.useFakeTimers()
    const cache = setup()
    const first = cache.cssHeld({}, { margin: 3 })
    const release = first.hold?.() as () => void
    const rules = cache.getFullRules(first.className)
    release()
    await vi.runAllTimersAsync()
    expect(cache.getFullRules(first.className)).toEqual([])
    const again = cache.cssHeld({}, { margin: 3 })
    expect(again.className).toBe(first.className)
    expect(cache.getFullRules(again.className)).not.toBe(rules)
    expect(cache.getFullRules(again.className)).toEqual(rules)
    vi.useRealTimers()
  })

  it('gives no rules for a theme class without pruning that the page already has, as before', () => {
    const id = createThemeId('u', '--u-a:1;')
    const element = document.createElement('style')
    element.dataset.precedence = 'u'
    element.textContent = `.${id}{--u-a:1;}`
    document.head.appendChild(element)
    const cache = createCache({ prefix: 'u', hasLayers: false, hasPruning: false })
    expect(createThemeClass(cache, { '--u-a': '1' })).toBe(id)
    expect(cache.getFullRules(id)).toEqual([])
    element.remove()
  })
})
