import { createApp, createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createCache, createDomSheet } from '@umber-style/core'
import { CacheProvider } from './CacheProvider'
import { createStyle } from './createStyle'
import type { StyleValueRef } from './types'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** The declarations in the element of the values of `prefix`, by variable. */
function readDeclared(prefix: string, page: Document = document): Record<string, string> {
  const element = page.head.querySelector<HTMLStyleElement>(`style[data-style="${prefix}-values"]`)
  const declared: Record<string, string> = {}
  for (const outer of element?.sheet?.cssRules ?? []) {
    const { style } = (outer as CSSGroupingRule).cssRules[0] as CSSStyleRule
    declared[style[0]] = style.getPropertyValue(style[0])
  }
  return declared
}

/** A thumb whose left side reads a value; it counts its renders and hands out its value. */
function createSlider(prefix: string, setInSetup?: number) {
  const style = createStyle({}, { prefix })
  const Thumb = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })
  const seen = { renders: 0, left: undefined as unknown as StyleValueRef }
  const Slider = defineComponent({
    setup() {
      const left = style.useStyleValue(10, '%')
      if (setInSetup !== undefined) left.value = setInSetup
      seen.left = left
      return () => {
        seen.renders += 1
        return h(Thumb, { 'data-testid': 'thumb', style: { left: `${left}` } })
      }
    },
  })
  return { style, Slider, seen }
}

/** Mounts `component` in a new element of the page. */
function mount(component: Parameters<typeof createApp>[0]) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(component)
  app.mount(container)
  return { app, container }
}

describe('useStyleValue in Vue', () => {
  it('is a reference in a style, and a ref in shape: value reads and sets the number with no render', () => {
    const { Slider, seen } = createSlider('wa')
    const { container } = mount(Slider)
    const { left } = seen
    expect(String(left)).toMatch(/^var\(--wa-value-\w+, 10%\)$/)
    expect(Object.keys(left)).not.toContain('value')
    const name = String(left).slice(4).split(',')[0]
    expect(readDeclared('wa')).toEqual({ [name]: '10%' })
    const className = (container.firstElementChild as HTMLElement).className
    for (let step = 1; step <= 300; step += 1) left.value = step / 10
    expect(readDeclared('wa')).toEqual({ [name]: '30%' })
    expect([left.value, left.get()]).toEqual([30, 30])
    expect(seen.renders).toBe(1)
    expect((container.firstElementChild as HTMLElement).className).toBe(className)
  })

  it('declares the number set in setup when it mounts, and removes its rule when it unmounts', () => {
    const { Slider } = createSlider('wb', 25)
    const { app } = mount(Slider)
    expect(Object.values(readDeclared('wb'))).toEqual(['25%'])
    app.unmount()
    expect(readDeclared('wb')).toEqual({})
  })

  it('names its variable after a CacheProvider above, in the document of that cache', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const frame = iframe.contentDocument as Document
    const cache = createCache({ prefix: 'wframe', sheet: createDomSheet('wframe', frame.head) })
    const { Slider, seen } = createSlider('wc')
    mount(() => h(CacheProvider, { value: cache }, () => h(Slider)))
    expect(String(seen.left)).toMatch(/^var\(--wframe-value-\w+, 10%\)$/)
    expect(Object.values(readDeclared('wframe', frame))).toEqual(['10%'])
  })

  it('sends the first number on a server as the fallback of its variable, and hydrates with the same name', async () => {
    const { Slider, seen } = createSlider('wd')
    const html = await renderToString(createSSRApp(Slider))
    const serverValue = String(seen.left)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    createSSRApp(Slider).mount(container)
    expect(warn).not.toHaveBeenCalled()
    expect(String(seen.left)).toBe(serverValue)
    expect(Object.values(readDeclared('wd'))).toEqual(['10%'])
    warn.mockRestore()
  })
})
