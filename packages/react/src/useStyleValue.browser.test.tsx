import { createPortal, flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactNode } from 'react'
import { createCache, createDomSheet, type LiveValue } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import type { StyleValueSetter } from './types'

const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount())
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** A real React render into the real document. */
function renderInPage(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  flushSync(() => root.render(node))
}

/** The number of rules in every style sheet of `page`, nested rules included. */
function countRules(page: Document = document): number {
  const count = (rules: CSSRuleList): number =>
    [...rules].reduce(
      (total, rule) =>
        total + 1 + ('cssRules' in rule ? count((rule as CSSGroupingRule).cssRules) : 0),
      0
    )
  return [...page.styleSheets].reduce((total, sheet) => total + count(sheet.cssRules), 0)
}

/** A thumb whose left side is a value in px; it counts its renders and hands out its setter. */
function createThumb(prefix: string, transition?: string) {
  const style = createStyle({}, { prefix })
  const Box = style.styled('div', { name: 'Box' })({
    position: 'absolute',
    width: 10,
    height: 10,
    transition,
  })
  const seen = {
    renders: 0,
    set: undefined as unknown as StyleValueSetter,
    value: undefined as unknown as LiveValue,
  }
  function Thumb() {
    const [left, setLeft] = style.useStyleValue(0, 'px')
    seen.renders += 1
    seen.set = setLeft
    seen.value = left
    return <Box data-testid={`${prefix}-thumb`} style={{ left: `${left}` }} />
  }
  return { style, Thumb, seen }
}

const readLeft = (element: Element) => getComputedStyle(element).left

describe('useStyleValue in a browser', () => {
  it('changes the computed value at each of 300 calls of the setter, with no rule written or removed and one render', () => {
    const { Thumb, seen } = createThumb('va')
    renderInPage(<Thumb />)
    const element = document.querySelector('[data-testid="va-thumb"]') as HTMLElement
    const className = element.className
    const rules = countRules()
    expect(readLeft(element)).toBe('0px')
    for (let step = 1; step <= 300; step += 1) {
      seen.set(step)
      expect(readLeft(element)).toBe(`${step}px`)
    }
    expect(countRules()).toBe(rules)
    expect(seen.renders).toBe(1)
    expect(element.className).toBe(className)
    expect(seen.value.get()).toBe(300)
  })

  it('is declared inside the theme layer of the engine, which the page CSS outside every layer still beats for the property', () => {
    const { Thumb, seen } = createThumb('vb')
    renderInPage(<Thumb />)
    const element = document.querySelector('[data-testid="vb-thumb"]') as HTMLElement
    const values = document.querySelector('style[data-style="vb-values"]') as HTMLStyleElement
    const [outer] = values.sheet?.cssRules ?? []
    expect(outer).toBeInstanceOf(CSSLayerBlockRule)
    expect((outer as CSSLayerBlockRule).name).toBe('vb-theme')
    seen.set(40)
    expect(readLeft(element)).toBe('40px')
    const page = document.createElement('style')
    page.textContent = '[data-testid="vb-thumb"]{left:5px}'
    document.head.appendChild(page)
    expect(readLeft(element)).toBe('5px')
    page.remove()
    seen.set(41)
    expect(readLeft(element)).toBe('41px')
  })

  it('runs a transition on the property that reads the variable, when the setter changes it', () => {
    const { Thumb, seen } = createThumb('vc', 'left 2s linear')
    renderInPage(<Thumb />)
    const element = document.querySelector('[data-testid="vc-thumb"]') as HTMLElement
    expect(readLeft(element)).toBe('0px')
    seen.set(200)
    const [transition] = element.getAnimations()
    expect(transition).toBeInstanceOf(CSSTransition)
    expect((transition as CSSTransition).transitionProperty).toBe('left')
    transition.pause()
    transition.currentTime = 1000
    expect(readLeft(element)).toBe('100px')
    expect(seen.renders).toBe(1)
  })

  it('is declared in the sheet of another document under a CacheProvider whose cache writes there', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    const cache = createCache({ prefix: 'vd', sheet: createDomSheet('vd', frame.head) })
    const { Thumb, seen } = createThumb('vm')
    renderInPage(<CacheProvider value={cache}>{createPortal(<Thumb />, frame.body)}</CacheProvider>)
    const element = frame.querySelector('[data-testid="vm-thumb"]') as HTMLElement
    expect(String(seen.value)).toMatch(/^var\(--vd-value-\w+, 0px\)$/)
    expect(frame.querySelector('style[data-style="vd-values"]')).not.toBeNull()
    expect(document.querySelector('style[data-style="vd-values"]')).toBeNull()
    const rules = countRules(frame)
    for (let step = 1; step <= 30; step += 1) {
      seen.set(step * 2)
      expect(getComputedStyle(element).left).toBe(`${step * 2}px`)
    }
    expect(countRules(frame)).toBe(rules)
    expect(seen.renders).toBe(1)
  })

  it('removes its rule when the component unmounts', () => {
    const { Thumb } = createThumb('ve')
    renderInPage(<Thumb />)
    const values = document.querySelector('style[data-style="ve-values"]') as HTMLStyleElement
    expect(values.sheet?.cssRules).toHaveLength(1)
    for (const root of roots.splice(0)) flushSync(() => root.unmount())
    expect(values.sheet?.cssRules).toHaveLength(0)
  })
})
