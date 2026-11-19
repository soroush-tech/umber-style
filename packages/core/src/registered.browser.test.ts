import { createEngine } from './createEngine'
import type { WebStyleObject } from './webStyle'

let count = 0
const nextPrefix = () => `rg${++count}`

const light = { palette: { primary: '#0000ff', other: '#00ff00' }, space: [0, 4, 8] }
const dark = { palette: { primary: '#ff0000' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

function propertyNames(): string[] {
  const names: string[] = []
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.constructor.name === 'CSSPropertyRule')
        names.push((rule as { name?: string }).name ?? '')
    }
  }
  return names
}

const parse = (value: string) => {
  const match = /rgba?\((\d+), (\d+), (\d+)/.exec(value)
  if (!match) throw new Error(`not an rgb color: ${value}`)
  return { red: Number(match[1]), green: Number(match[2]), blue: Number(match[3]) }
}

const transitions = (element: Element) =>
  element.getAnimations().map((animation) => (animation as CSSTransition).transitionProperty)

function setup(registered: boolean, ownStyle: (prefix: string) => WebStyleObject) {
  const prefix = nextPrefix()
  const engine = createEngine(light, {
    prefix,
    ...(registered && { registered: { palette: true } }),
  })
  const lightClass = engine.themeClass(light, 'light')
  const darkClass = engine.themeClass(dark, 'dark')
  const own = engine.cache.css(ownStyle(prefix))
  const use = engine.cache.css({ color: engine.refs.palette.primary })
  const wrapper = document.createElement('div')
  wrapper.className = `${lightClass} ${own}`
  const child = document.createElement('span')
  child.className = use
  wrapper.appendChild(child)
  document.body.appendChild(wrapper)
  return { prefix, wrapper, child, own, darkClass }
}

describe('registered tokens in a real browser', () => {
  it('accepts @property, and a registered color token resolves to a computed color', () => {
    const { prefix, child } = setup(true, () => ({}))
    expect(propertyNames()).toContain(`--${prefix}-palette-primary`)
    expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')
    // A registered color is typed: the variable itself computes to a color, not to the text.
    expect(getComputedStyle(child).getPropertyValue(`--${prefix}-palette-primary`)).toBe(
      'rgb(0, 0, 255)'
    )
  })

  it('a color transition on the element that uses the token is mid-way between both ends after a theme class change', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix, registered: { palette: true } })
    const lightClass = engine.themeClass(light, 'light')
    const darkClass = engine.themeClass(dark, 'dark')
    const use = engine.cache.css({
      color: engine.refs.palette.primary,
      transition: 'color 2s linear',
    })
    const wrapper = document.createElement('div')
    wrapper.className = lightClass
    const child = document.createElement('span')
    child.className = use
    wrapper.appendChild(child)
    document.body.appendChild(wrapper)
    expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')

    wrapper.className = darkClass
    expect(transitions(child)).toEqual(['color'])
    const animation = child.getAnimations()[0]
    animation.pause()
    animation.currentTime = 1000
    // Halfway between blue and red.
    expect(parse(getComputedStyle(child).color)).toEqual({ red: 128, green: 0, blue: 128 })
  })

  it('a registered token itself is transitioned on the element that carries the theme class', () => {
    const { prefix, wrapper, child, own, darkClass } = setup(true, (name) => ({
      transition: `--${name}-palette-primary 2s linear`,
    }))
    expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')
    wrapper.className = `${darkClass} ${own}`
    expect(transitions(wrapper)).toEqual([`--${prefix}-palette-primary`])
    const animation = wrapper.getAnimations()[0]
    animation.pause()
    animation.currentTime = 1000
    expect(parse(getComputedStyle(child).color)).toEqual({ red: 128, green: 0, blue: 128 })
  })

  it('without registration a transition of the variable does not run: the color jumps', () => {
    const { wrapper, child, own, darkClass } = setup(false, (name) => ({
      transition: `--${name}-palette-primary 2s linear`,
    }))
    expect(getComputedStyle(child).color).toBe('rgb(0, 0, 255)')
    wrapper.className = `${darkClass} ${own}`
    expect(transitions(wrapper)).toEqual([])
    expect(getComputedStyle(child).color).toBe('rgb(255, 0, 0)')
  })
})
