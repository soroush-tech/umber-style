import { createCache, createDomSheet } from './cache'
import { createEngine } from './createEngine'

let count = 0
// A new prefix for each test: every engine writes into its own style element of the real document.
const nextPrefix = () => `st${++count}`

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const mount = (className: string) => {
  const element = document.createElement('p')
  element.className = className
  element.textContent = 'text'
  document.body.appendChild(element)
  return element
}

const light = { palette: { text: 'rgb(1, 2, 3)', surface: 'rgb(4, 5, 6)' } }
const dark = { palette: { text: 'rgb(7, 8, 9)', surface: 'rgb(10, 11, 12)' } }

/** An engine whose DOM sheet writes as `hasRuleText` says, over a cache of its own prefix. */
function createModeEngine(hasRuleText: boolean) {
  const prefix = nextPrefix()
  const sheet = createDomSheet(prefix, document.head, { hasRuleText })
  const engine = createEngine(light, { cache: createCache({ prefix, sheet }) })
  const element = document.querySelector(`style[data-style="${prefix}"]`) as HTMLStyleElement
  return { engine, element }
}

describe.each([true, false])('the cascade of a sheet with hasRuleText %s', (hasRuleText) => {
  it('orders the layers by the statement: a global rule, a component, then what is given from outside', () => {
    const { engine, element } = createModeEngine(hasRuleText)
    const release = engine.insertGlobal({ p: { color: 'rgb(0, 128, 0)', marginLeft: 3 } })
    const own = engine.css({ color: 'rgb(255, 0, 0)', padding: 2 })
    const outside = engine.cache.cssIn('overrides', { padding: 5 })
    const target = mount(`${own} ${outside}`)
    const style = getComputedStyle(target)
    expect([style.color, style.marginLeft, style.padding]).toEqual(['rgb(255, 0, 0)', '3px', '5px'])
    // Released, the global rule leaves the cascade.
    release()
    expect(getComputedStyle(target).marginLeft).toBe('0px')
    expect(element.textContent === '').toBe(!hasRuleText)
  })

  it('gives the values of the root theme that was written last, after the rule is written anew', () => {
    const { engine, element } = createModeEngine(hasRuleText)
    const target = mount(
      engine.css({ color: engine.refs.palette.text, backgroundColor: engine.refs.palette.surface })
    )
    engine.declareRoot(light)
    expect(getComputedStyle(target).color).toBe('rgb(1, 2, 3)')
    engine.declareRoot(dark, 'dark')
    const style = getComputedStyle(target)
    expect([style.color, style.backgroundColor, style.colorScheme]).toEqual([
      'rgb(7, 8, 9)',
      'rgb(10, 11, 12)',
      'dark',
    ])
    // One root rule is live: the one of the dark theme.
    const roots = [...(element.sheet as CSSStyleSheet).cssRules].filter((rule) =>
      rule.cssText.includes(':root')
    )
    expect(roots).toHaveLength(1)
  })
})
