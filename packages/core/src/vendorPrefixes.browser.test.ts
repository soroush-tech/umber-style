import type { WebStyleObject } from './webStyle'
import { createCache } from './cache'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** An element with the class of `style`, made by a cache with the prefixed forms (the default) or without them. */
function render(style: WebStyleObject, hasVendorPrefixes = true): Element {
  const cache = createCache({ prefix: `vp${hasVendorPrefixes ? 'on' : 'off'}`, hasVendorPrefixes })
  const element = document.createElement('div')
  element.className = cache.css(style)
  document.body.appendChild(element)
  return element
}

/** The computed value of `property` for `element`. */
const readComputed = (element: Element, property: string) =>
  getComputedStyle(element).getPropertyValue(property)

describe('the prefixed forms in Chromium', () => {
  it('computes each prefixed property that Chromium knows to the value that was set', () => {
    const element = render({
      userSelect: 'none',
      printColorAdjust: 'exact',
      boxDecorationBreak: 'clone',
      textDecoration: 'underline dotted',
    })
    expect(readComputed(element, '-webkit-user-select')).toBe('none')
    expect(readComputed(element, 'user-select')).toBe('none')
    expect(readComputed(element, '-webkit-print-color-adjust')).toBe('exact')
    expect(readComputed(element, '-webkit-box-decoration-break')).toBe('clone')
    expect(readComputed(element, 'text-decoration-style')).toBe('dotted')
  })

  it('computes the width of stretch, written after its prefixed values', () => {
    const page = document.createElement('style')
    page.textContent = '.box { width: 300px; }'
    document.head.appendChild(page)
    const parent = document.createElement('div')
    parent.className = 'box'
    document.body.appendChild(parent)
    const element = render({ width: 'stretch', marginLeft: '20px' })
    parent.appendChild(element)
    expect(readComputed(element, 'width')).toBe('280px')
  })

  it('computes the same values without the option, where Chromium needs no prefixed form', () => {
    const element = render({ userSelect: 'none', printColorAdjust: 'exact' }, false)
    expect(readComputed(element, 'user-select')).toBe('none')
    expect(readComputed(element, 'print-color-adjust')).toBe('exact')
  })
})
