import { userEvent } from 'vitest/browser'
import { createEngine } from './createEngine'

let count = 0
// A new prefix for each test: every engine writes into its own style element of the real document.
const nextPrefix = () => `cb${++count}`

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const mount = (tag: string, className: string) => {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = 'text'
  document.body.appendChild(element)
  return element
}
const color = (element: Element) => getComputedStyle(element).color

describe('cascade layers in a real browser', () => {
  it('a style given from outside beats the own plain property and the own :hover rule', async () => {
    const { cache } = createEngine(theme, { prefix: nextPrefix() })
    const own = cache.css({ color: 'rgb(255, 0, 0)', '&:hover': { color: 'rgb(255, 165, 0)' } })
    const outside = cache.cssIn('overrides', { color: 'rgb(0, 0, 255)' })
    const element = mount('button', `${own} ${outside}`)
    expect(color(element)).toBe('rgb(0, 0, 255)')
    // The pointer is really moved over the element: the :hover state is the browser's own.
    await userEvent.hover(element)
    expect(element.matches(':hover')).toBe(true)
    expect(color(element)).toBe('rgb(0, 0, 255)')
  })

  it('the own :hover rule applies while hovered when nothing is given from outside', async () => {
    const { cache } = createEngine(theme, { prefix: nextPrefix() })
    const own = cache.css({ color: 'rgb(255, 0, 0)', '&:hover': { color: 'rgb(255, 165, 0)' } })
    const element = mount('button', own)
    expect(color(element)).toBe('rgb(255, 0, 0)')
    await userEvent.hover(element)
    expect(color(element)).toBe('rgb(255, 165, 0)')
  })

  it('unlayered page CSS beats the engine rules, the overrides layer included', () => {
    const { cache } = createEngine(theme, { prefix: nextPrefix() })
    const own = cache.css({ color: 'rgb(255, 0, 0)' })
    const outside = cache.cssIn('overrides', { color: 'rgb(0, 0, 255)' })
    const page = document.createElement('style')
    page.textContent = '.page-rule { color: rgb(0, 128, 0); }'
    document.head.appendChild(page)
    const element = mount('p', `${own} ${outside} page-rule`)
    expect(color(element)).toBe('rgb(0, 128, 0)')
  })

  it('a reset in a layer declared before the engine layers is beaten by a component', () => {
    const prefix = nextPrefix()
    const reset = document.createElement('style')
    reset.textContent = `@layer reset, ${prefix}-theme, ${prefix}-global, ${prefix}-components, ${prefix}-overrides;
@layer reset { button { background-color: rgb(1, 2, 3); } }`
    document.head.appendChild(reset)
    const { cache } = createEngine(theme, { prefix })
    const own = cache.css({ backgroundColor: 'rgb(255, 0, 0)' })
    const element = mount('button', own)
    expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 0, 0)')
    // A control: the same element with no component class shows the reset.
    const bare = mount('button', '')
    expect(getComputedStyle(bare).backgroundColor).toBe('rgb(1, 2, 3)')
  })

  it('an unlayered reset beats the component: the reason to put a reset in a layer', () => {
    const { cache } = createEngine(theme, { prefix: nextPrefix() })
    const reset = document.createElement('style')
    reset.textContent = 'button { background-color: rgb(1, 2, 3); }'
    document.head.appendChild(reset)
    const element = mount('button', cache.css({ backgroundColor: 'rgb(255, 0, 0)' }))
    expect(getComputedStyle(element).backgroundColor).toBe('rgb(1, 2, 3)')
  })
})
