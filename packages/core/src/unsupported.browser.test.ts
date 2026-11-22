import { createCache } from './cache'
import type { WebStyleObject } from './webStyle'

let count = 0
const nextPrefix = () => `us${++count}`

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

/** A style with what the web types do not have, as a style shared with React Native may hold. */
const untyped = (style: object) => style as WebStyleObject

/** Longer than the wait of the development checker after the last insertion. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

function startCache() {
  const prefix = nextPrefix()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const cache = createCache({ prefix, hasDevChecks: true })
  return { prefix, warn, cache }
}

describe('the development checker asks the browser about each declaration, in a real browser', () => {
  it('warns once about a property that the browser does not have, which it drops from the rule', async () => {
    const { prefix, warn, cache } = startCache()
    const name = cache.css(untyped({ elevation: 2, color: 'red' }))
    cache.css(untyped({ elevation: 2, color: 'red' }))
    await settle()
    const sheet = document.querySelector<HTMLStyleElement>(`style[data-style="${prefix}"]`)?.sheet
    const text = [...(sheet?.cssRules ?? [])].map((rule) => rule.cssText).join('')
    expect(text).toContain('color: red')
    expect(text).not.toContain('elevation')
    expect(warn.mock.calls).toEqual([
      [`[${prefix}] the class ${name} declares elevation:2px, which this browser does not support`],
    ])
  })

  it('warns once about a value that the browser rejects for its property, naming the class and its component', async () => {
    expect(CSS.supports('border-color', 'light')).toBe(false)
    const { prefix, warn, cache } = startCache()
    const name = cache.cssWith({ label: 'Button-root' }, { borderColor: 'light', color: 'red' })
    cache.cssWith({ label: 'Button-root' }, { borderColor: 'light', color: 'red' })
    const plain = cache.css({ borderColor: 'light' })
    await settle()
    expect(warn.mock.calls).toEqual([
      [
        `[${prefix}] the class ${name} of "Button-root" declares border-color:light, which this browser does not support`,
      ],
      [
        `[${prefix}] the class ${plain} declares border-color:light, which this browser does not support`,
      ],
    ])
  })

  it('says nothing about a property or a value with a vendor prefix that this browser does not have', async () => {
    expect(CSS.supports('-moz-osx-font-smoothing', 'grayscale')).toBe(false)
    const { warn, cache } = startCache()
    cache.css({ MozOsxFontSmoothing: 'grayscale', WebkitFontSmoothing: 'antialiased' })
    expect(CSS.supports('width', '-moz-available')).toBe(false)
    cache.css(untyped({ width: '-moz-available' }))
    await settle()
    expect(warn).not.toHaveBeenCalled()
  })

  it('says nothing about the earlier items of a fallback list, and asks about the last one', async () => {
    expect(CSS.supports('display', '-moz-box')).toBe(false)
    expect(CSS.supports('display', 'flex')).toBe(true)
    const { prefix, warn, cache } = startCache()
    cache.css(untyped({ display: ['-moz-box', 'flex'] }))
    await settle()
    expect(warn).not.toHaveBeenCalled()
    const name = cache.css(untyped({ display: ['-moz-box', 'flex', 'not-a-display'] }))
    await settle()
    expect(warn.mock.calls).toEqual([
      [
        `[${prefix}] the class ${name} declares display:not-a-display, which this browser does not support`,
      ],
    ])
  })

  it('asks whether the browser knows the property of a value with a variable', async () => {
    const { prefix, warn, cache } = startCache()
    cache.css({ color: 'var(--anything)' })
    const name = cache.css(untyped({ elevation: 'var(--anything)' }))
    await settle()
    expect(warn.mock.calls).toEqual([
      [
        `[${prefix}] the class ${name} declares elevation:var(--anything), which this browser does not support`,
      ],
    ])
  })
})
