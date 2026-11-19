import { alpha } from './alpha'
import { createEngine } from './createEngine'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('alpha() in a real browser', () => {
  it('writes the fallback and the color-mix() declaration, and the browser computes the color-mix result', () => {
    const engine = createEngine({ palette: { primary: '#0000ff' } }, { prefix: 'al' })
    const className = engine.cache.css({ color: alpha('#0000ff', 0.5) })
    const { css } = engine.cache.extract()
    const rule = css.slice(css.indexOf(`.${className}`))
    const fallback = rule.indexOf('rgba(0, 0, 255, 0.5)')
    expect(fallback).toBeGreaterThan(-1)
    expect(rule.indexOf('color-mix(')).toBeGreaterThan(fallback)

    // Controls written as page CSS: what each declaration alone computes to in this browser.
    const page = document.createElement('style')
    page.textContent =
      '.control-mix { color: color-mix(in srgb, #0000ff 50%, transparent); } .control-fallback { color: rgba(0, 0, 255, 0.5); }'
    document.head.appendChild(page)
    const computed = (name: string) => {
      const element = document.createElement('span')
      element.className = name
      document.body.appendChild(element)
      return getComputedStyle(element).color
    }
    const subject = document.createElement('span')
    subject.className = className
    document.body.appendChild(subject)

    expect(computed('control-mix')).not.toBe(computed('control-fallback'))
    expect(getComputedStyle(subject).color).toBe(computed('control-mix'))
  })
})
