import { createEngine } from './createEngine'

let count = 0
const nextPrefix = () => `kf${++count}`

const light = { palette: { start: '#0000ff', end: '#ff0000' } }

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('keyframes in a real browser', () => {
  it('runs a registered animation: the rule is parsed, the element runs it, and a token in a step resolves', () => {
    const prefix = nextPrefix()
    const engine = createEngine(light, { prefix })
    const fade = engine.keyframes(
      (theme: typeof light) => ({
        from: { opacity: 0, color: theme.palette.start },
        to: { opacity: 1, color: theme.palette.end },
      }),
      { label: 'fade' }
    )
    // Paused half way through a linear run, so the computed values are the middle of the steps.
    const className = engine.css({
      animation: `${fade} 100s linear paused`,
      animationDelay: -50000,
    })
    const element = document.createElement('div')
    element.className = `${engine.themeClass(light)} ${className}`
    document.body.appendChild(element)

    const style = getComputedStyle(element)
    expect(style.animationName).toBe(fade)
    expect(style.animationDelay).toBe('-50s')
    const running = document.getAnimations() as CSSAnimation[]
    expect(running.map((animation) => animation.animationName)).toEqual([fade])
    expect(Number(style.opacity)).toBeCloseTo(0.5, 2)
    expect(style.color).toMatch(/^rgb\(12[78], 0, 12[78]\)$/)
  })
})
