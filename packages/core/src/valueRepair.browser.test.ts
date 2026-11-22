import { createEngine } from './createEngine'

let count = 0
const nextPrefix = () => `vr${++count}`

const theme = {
  palette: { primary: '#0000ff' },
  space: [0, 4, 8],
  transitions: { duration: { short: 150 }, delay: { short: 0.5 } },
}

type AppTheme = typeof theme

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const wrap = (parent: Element, className: string) => {
  const element = document.createElement('div')
  element.className = className
  parent.appendChild(element)
  return element
}

/** The computed style of an element with the class of a style that builds strings from tokens, under the theme class. */
function render(hasValueRepair: boolean): CSSStyleDeclaration {
  const engine = createEngine<AppTheme>(theme, { prefix: nextPrefix(), hasValueRepair })
  const { palette, space, transitions } = engine.refs
  const className = engine.css({
    color: `${palette.primary}80`,
    marginLeft: `-${space[2]}`,
    transitionDuration: `${transitions.duration.short}ms`,
    transitionDelay: `${transitions.delay.short}s`,
  })
  return getComputedStyle(wrap(wrap(document.body, engine.themeClass(theme)), className))
}

describe('the string forms of token maths in a real browser', () => {
  it('computes a colour with alpha, a negative length and a duration with hasValueRepair', () => {
    // A control written as page CSS: what the colour at 0x80 / 255 computes to in this browser.
    const page = document.createElement('style')
    page.textContent = '.control { color: color-mix(in srgb, #0000ff 50.2%, transparent); }'
    document.head.appendChild(page)
    const control = getComputedStyle(wrap(document.body, 'control')).color

    const computed = render(true)
    expect(control).not.toBe('rgb(0, 0, 255)')
    expect(computed.color).toBe(control)
    expect(computed.marginLeft).toBe('-8px')
    expect(computed.transitionDuration).toBe('0.15s')
    expect(computed.transitionDelay).toBe('0.5s')
  })

  it('drops each of them without the option: the text is not valid CSS', () => {
    const computed = render(false)
    expect(computed.color).toBe('rgb(0, 0, 0)')
    expect(computed.marginLeft).toBe('0px')
    expect(computed.transitionDuration).toBe('0s')
    expect(computed.transitionDelay).toBe('0s')
  })
})
