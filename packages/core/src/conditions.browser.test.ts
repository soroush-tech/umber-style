import { cdp } from 'vitest/browser'
import { at } from './at'
import { createEngine } from './createEngine'

// The Chrome DevTools Protocol session of the test page (the Playwright provider's).
const session = cdp() as unknown as { send(method: string, params?: object): Promise<unknown> }

let count = 0
const nextPrefix = () => `cn${++count}`

const themeA = { palette: { primary: '#ff0000' } }
const themeB = { palette: { primary: '#0000ff' } }

afterEach(async () => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  await session.send('Emulation.setEmulatedMedia', { features: [] })
})

const GREEN = 'rgb(0, 128, 0)'
const BLACK = 'rgb(0, 0, 0)'

const wrap = (parent: Element, className: string) => {
  const element = document.createElement('div')
  element.className = className
  parent.appendChild(element)
  return element
}
const leaf = (parent: Element, className: string) => {
  const element = document.createElement('span')
  element.className = className
  element.textContent = 'x'
  parent.appendChild(element)
  return element
}
const color = (element: Element) => getComputedStyle(element).color

describe('scoped theme conditions in a real browser', () => {
  it('when(A) is applied under A, not under a B inside it, and again under an A inside that B', () => {
    const engine = createEngine(themeA, { prefix: nextPrefix() })
    const style = engine.cache.css({
      color: 'rgb(0, 0, 0)',
      ...at(engine.when(themeA, 'light'), { color: GREEN }),
    })
    const outer = wrap(document.body, engine.themeClass(themeA, 'light'))
    const first = leaf(outer, style)
    const inner = wrap(outer, engine.themeClass(themeB, 'light'))
    const second = leaf(inner, style)
    const innermost = wrap(inner, engine.themeClass(themeA, 'light'))
    const third = leaf(innermost, style)
    expect([color(first), color(second), color(third)]).toEqual([GREEN, BLACK, GREEN])
  })

  it('whenScheme follows an explicit scheme of the nearest theme', () => {
    const engine = createEngine(themeA, { prefix: nextPrefix() })
    const style = engine.cache.css({
      color: 'rgb(0, 0, 0)',
      ...at(engine.whenScheme('dark'), { color: GREEN }),
    })
    const dark = wrap(document.body, engine.themeClass(themeA, 'dark'))
    const light = wrap(dark, engine.themeClass(themeB, 'light'))
    const darkAgain = wrap(light, engine.themeClass(themeA, 'dark'))
    expect([
      color(leaf(dark, style)),
      color(leaf(light, style)),
      color(leaf(darkAgain, style)),
    ]).toEqual([GREEN, BLACK, GREEN])
  })

  it('whenScheme follows the emulated system preference where no theme gives a scheme', async () => {
    const engine = createEngine(themeA, { prefix: nextPrefix() })
    const style = engine.cache.css({
      color: 'rgb(0, 0, 0)',
      ...at(engine.whenScheme('dark'), { color: GREEN }),
    })
    const bare = leaf(document.body, style)
    const explicitLight = leaf(wrap(document.body, engine.themeClass(themeA, 'light')), style)
    expect(color(bare)).toBe(BLACK)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    })
    expect(matchMedia('(prefers-color-scheme: dark)').matches).toBe(true)
    expect(color(bare)).toBe(GREEN)
    // An explicit scheme above takes the decision from the system.
    expect(color(explicitLight)).toBe(BLACK)
  })
})
