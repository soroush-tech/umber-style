import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { createStyle } from './createStyle'

const theme = { palette: { primary: '#0000ff' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** Waits for the delay before a removal: one macrotask. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('a plain object in style, in a real browser', () => {
  it('leaves one rule of fifty widths, and the element has the right width at each step', async () => {
    const { styled } = createStyle(theme, { prefix: 'hb' })
    const Bar = styled('div', { name: 'Bar' })({ height: 4 })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    // Outside production each rule is a style element of its own: the rules of all of them, in order.
    const widthRules = () =>
      [...document.querySelectorAll<HTMLStyleElement>('style[data-style="hb"]')]
        .flatMap((element) => [...(element.sheet as CSSStyleSheet).cssRules])
        .map((rule) => rule.cssText)
        .filter((text) => text.includes('width'))

    for (let width = 1; width <= 50; width++) {
      flushSync(() => root.render(<Bar style={{ width }} />))
      const element = container.firstElementChild as HTMLElement
      expect(getComputedStyle(element).width).toBe(`${width}px`)
      expect(element.hasAttribute('style')).toBe(false)
      await nextTask()
      expect(widthRules()).toHaveLength(1)
    }
    expect(widthRules()).toEqual([expect.stringContaining('width: 50px')])
    flushSync(() => root.unmount())
    await nextTask()
    expect(widthRules()).toEqual([])
  })
})
