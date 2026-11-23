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

/** An engine whose DOM sheet writes as `speedy` says, over a cache of its own prefix. */
function createModeEngine(speedy: boolean) {
  const prefix = nextPrefix()
  const sheet = createDomSheet(prefix, document.head, { speedy })
  const engine = createEngine(light, { cache: createCache({ prefix, sheet }) })
  // The first element of the sheet, which it makes at its first rule.
  const readElement = () =>
    document.querySelector(`style[data-style="${prefix}"]`) as HTMLStyleElement
  return { engine, readElement }
}

describe.each([true, false])('the cascade of a sheet with speedy %s', (speedy) => {
  it('orders the layers by the statement: a global rule, a component, then what is given from outside', () => {
    const { engine, readElement } = createModeEngine(speedy)
    const release = engine.insertGlobal({ p: { color: 'rgb(0, 128, 0)', marginLeft: 3 } })
    const own = engine.css({ color: 'rgb(255, 0, 0)', padding: 2 })
    const outside = engine.cache.cssIn('overrides', { padding: 5 })
    const target = mount(`${own} ${outside}`)
    const style = getComputedStyle(target)
    expect([style.color, style.marginLeft, style.padding]).toEqual(['rgb(255, 0, 0)', '3px', '5px'])
    // Released, the global rule leaves the cascade.
    release()
    expect(getComputedStyle(target).marginLeft).toBe('0px')
    expect(readElement().textContent === '').toBe(speedy)
  })

  it('gives the values of the root theme that was written last, after the rule is written anew', () => {
    const { engine, readElement } = createModeEngine(speedy)
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
    const roots = readSheetRules(readElement().dataset.style as string).filter((rule) =>
      rule.cssText.includes(':root')
    )
    expect(roots).toHaveLength(1)
  })
})

/** The rules of the style elements `data-style="<key>"`, as the browser parsed them, in document order. */
function readSheetRules(key: string): CSSRule[] {
  return [...document.querySelectorAll<HTMLStyleElement>(`style[data-style="${key}"]`)].flatMap(
    (element) => [...(element.sheet as CSSStyleSheet).cssRules]
  )
}

/** 1600 rules, a class each, the last of which wins for `width` on an element that has every class. */
const MANY_RULES = Array.from({ length: 1600 }, (_, index) => `.m${index}{width:${index + 1}px;}`)

/** The time of writing `MANY_RULES` into a new sheet of `key`, and of the style of an element that has the class of every rule. */
function writeManyRules(key: string, speedy: boolean) {
  const start = performance.now()
  const sheet = createDomSheet(key, document.head, { speedy })
  for (const rule of MANY_RULES) sheet.insert(rule)
  const target = mount(MANY_RULES.map((_, index) => `m${index}`).join(' '))
  const width = getComputedStyle(target).width
  return { sheet, target, width, time: performance.now() - start }
}

describe('a sheet written by text, with many rules', () => {
  it('writes each of 1600 rules into an element of its own, in order, within a small factor of insertRule', () => {
    const byRules = writeManyRules(nextPrefix(), true)
    const key = nextPrefix()
    const byText = writeManyRules(key, false)
    const elements = [...document.querySelectorAll(`style[data-style="${key}"]`)]
    expect(elements.map((element) => element.textContent)).toEqual(MANY_RULES)
    expect(readSheetRules(key).map((rule) => rule.cssText)).toEqual(
      MANY_RULES.map((_, index) => `.m${index} { width: ${index + 1}px; }`)
    )
    expect([byText.width, byRules.width]).toEqual(['1600px', '1600px'])
    // The bound is loose on purpose, so that a busy machine does not fail it: what it catches is a time
    // that grows with the square of the rules, as when every rule parsed the text of one element again.
    console.info(
      `1600 rules: ${byText.time.toFixed(1)} ms by text, ${byRules.time.toFixed(1)} ms by insertRule`
    )
    expect(byText.time).toBeLessThan(Math.max(byRules.time * 5, 250))
    // A rule removed takes its element, and leaves the cascade.
    byText.sheet.remove?.(1599)
    expect(document.querySelectorAll(`style[data-style="${key}"]`)).toHaveLength(1599)
    expect(getComputedStyle(byText.target).width).toBe('1599px')
  })
})
