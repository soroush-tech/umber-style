import { createCache, createMemorySheet } from './cache'

// A copy of a rule that the cache wrote itself, in a style element that arrives on the page later: what a
// server component sends for a class that a client component wrote first, in a client-side navigation.

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** Lets the watch of the page report what arrived. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A style element of the form React gives a `<style href precedence>`, holding `css`, put before every other element of the head. */
function addEarlyElement(css: string, href = 'u-arrived'): HTMLStyleElement {
  const element = document.createElement('style')
  element.dataset.precedence = 'u'
  element.dataset.href = href
  element.textContent = css
  document.head.prepend(element)
  return element
}

/** The text of each rule of the sheet of `element`. */
const readRules = (element: HTMLStyleElement) =>
  [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText)

describe('a copy of a rule the cache wrote, arriving on the page', () => {
  it('is deleted from an element before the elements of the cache, which keep theirs; the other rules of the element stay', async () => {
    const cache = createCache({ prefix: 'u', hasLayers: false })
    const name = cache.css({ color: 'red' })
    const own = cache.getRules(name).join('')
    const arrived = addEarlyElement(`.u-other-1ab{margin:0;}${own}body{padding:0;}`)
    await settle()
    expect(readRules(arrived)).toEqual(['.u-other-1ab { margin: 0px; }', 'body { padding: 0px; }'])
    const kept = [...document.querySelectorAll<HTMLStyleElement>('style[data-style="u"]')]
    expect(kept.flatMap(readRules).join('')).toContain(`.${name}`)
    expect(arrived.textContent).toContain(own)
  })

  it('is deleted in every layer of the class, and an element left with no rule stays in the document', async () => {
    const cache = createCache({ prefix: 'u' })
    const name = cache.css({ color: 'red', ':hover': { color: 'blue' } })
    const rules = cache.getRules(name)
    expect(rules).toHaveLength(2)
    const arrived = addEarlyElement(rules.join(''), name)
    await settle()
    expect(readRules(arrived)).toEqual([])
    expect(arrived.isConnected).toBe(true)
    expect(cache.css({ color: 'red', ':hover': { color: 'blue' } })).toBe(name)
  })

  it('is kept for a held class, which the cache removes when nothing holds it', async () => {
    const cache = createCache({ prefix: 'u', hasLayers: false })
    const { className } = cache.cssHeld({ layer: 'overrides' }, { width: 4 })
    const arrived = addEarlyElement(cache.getRules(className).join(''))
    await settle()
    expect(readRules(arrived)).toHaveLength(1)
  })

  it('is kept when the element comes after the elements of the cache, where it is the copy that applies', async () => {
    const cache = createCache({ prefix: 'u', hasLayers: false })
    const name = cache.css({ color: 'red' })
    const arrived = document.createElement('style')
    arrived.dataset.precedence = 'u'
    arrived.textContent = cache.getRules(name).join('')
    document.body.append(arrived)
    await settle()
    expect(readRules(arrived)).toHaveLength(1)
  })

  it('is kept when the sheet of the cache is not in the page, or its elements were taken out of it', async () => {
    const inMemory = createCache({ prefix: 'u', hasLayers: false, sheet: createMemorySheet() })
    const first = addEarlyElement(inMemory.getRules(inMemory.css({ color: 'red' })).join(''))
    await settle()
    expect(readRules(first)).toHaveLength(1)

    const cache = createCache({ prefix: 'v', hasLayers: false })
    const name = cache.css({ color: 'red' })
    for (const element of document.querySelectorAll('style[data-style="v"]')) element.remove()
    const second = document.createElement('style')
    second.dataset.precedence = 'v'
    second.textContent = cache.getRules(name).join('')
    document.head.prepend(second)
    await settle()
    expect(readRules(second)).toHaveLength(1)
  })

  it('is kept when its text is not the one the cache wrote, or the class came from the page', async () => {
    const server = addEarlyElement('.u-page-1ab{margin:0;}')
    const cache = createCache({ prefix: 'u', hasLayers: false })
    const name = cache.css({ color: 'red' })
    const other = addEarlyElement(`.${name}{color:blue;}.u-page-1ab{margin:0;}`)
    await settle()
    expect(readRules(other)).toHaveLength(2)
    expect(readRules(server)).toHaveLength(1)
  })

  it('is kept when the browser kept another number of rules than the text holds', async () => {
    const cache = createCache({ prefix: 'u', hasLayers: false })
    const name = cache.css({ color: 'red' })
    const arrived = addEarlyElement(`${cache.getRules(name).join('')}@unknown{}`)
    await settle()
    expect(readRules(arrived).join('')).toContain(`.${name}`)
  })
})
