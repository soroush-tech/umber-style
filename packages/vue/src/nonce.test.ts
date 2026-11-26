import { createApp, defineComponent, h } from 'vue'
import { createStyle } from './createStyle'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** Mounts a styled box of a style of `prefix` with no nonce, and returns the style elements of the engine. */
function mountBox(prefix: string): Element[] {
  const { styled } = createStyle({ palette: { primary: '#0000ff' } }, { prefix })
  const Box = styled('div', { name: 'Box' })(({ theme }) => ({ color: theme.palette.primary }))
  const element = document.createElement('div')
  document.body.append(element)
  createApp(defineComponent({ render: () => h(Box) })).mount(element)
  return [...document.head.querySelectorAll(`style[data-style="${prefix}"]`)]
}

describe('the nonce of the page, for a style with none in the browser', () => {
  it('is on every style element of the engine on a page that has one', () => {
    const applied = document.createElement('style')
    applied.setAttribute('nonce', 'page')
    document.head.append(applied)
    const elements = mountBox('vn')
    expect(elements.length).toBeGreaterThan(0)
    expect(elements.every((element) => element.getAttribute('nonce') === 'page')).toBe(true)
  })

  it('is none on a page with no nonce', () => {
    const elements = mountBox('vm')
    expect(elements.length).toBeGreaterThan(0)
    expect(elements.some((element) => element.hasAttribute('nonce'))).toBe(false)
  })
})
