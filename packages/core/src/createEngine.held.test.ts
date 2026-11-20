import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

const theme = { palette: { primary: '#0000ff' } }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(options: { hasLayers?: boolean } = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ hasPruning: false, prefix: 'e', sheet, ...options })
  const engine = createEngine(theme, { prefix: 'e', cache })
  return { engine, sheet, cache }
}

describe('the held class of a styler', () => {
  it('is the override class of a plain object, held, after the class of the component', () => {
    const { engine, sheet } = setup()
    const styler = engine.createStyler({ name: 'Bar' }, [{ height: 4 }])
    const { className, hold } = styler.getHeldClass({}, [{ width: 10 }, 'mine'])
    const [own, outside, override] = className.split(' ')
    expect(own).toBe(styler.getClassName({}))
    expect(outside).toBe('mine')
    expect(override).toMatch(/^e-bar-root-/)
    ;(hold as () => () => void)()()
    vi.runAllTimers()
    expect(sheet.rules.some((rule) => rule.includes(override))).toBe(false)
    expect(sheet.rules.some((rule) => rule.includes(own))).toBe(true)
  })

  it('is the override class alone for a component with no style and no label', () => {
    const { engine } = setup()
    const { className } = engine.createStyler({}, []).getHeldClass({}, { width: 2 })
    expect(className).toMatch(/^e-[a-z0-9]+$/)
  })

  it('is the class of getClassName, with nothing to hold, when no plain object comes in', () => {
    const { engine, cache } = setup()
    const styler = engine.createStyler({ name: 'Bar' }, [{ height: 4 }])
    const entry = cache.createEntry({ width: 1 })
    expect(styler.getHeldClass({}, entry)).toEqual({
      className: styler.getClassName({}, entry),
      hold: undefined,
    })
    expect(styler.getHeldClass({}, [null, 'mine', false])).toEqual({
      className: styler.getClassName({}, 'mine'),
      hold: undefined,
    })
  })

  it('is the one merged class without layers, held', () => {
    const { engine, sheet } = setup({ hasLayers: false })
    const styler = engine.createStyler({ name: 'Bar' }, [
      ({ theme: view }: { theme: typeof theme }) => ({ color: view.palette.primary }),
    ])
    const { className, hold } = styler.getHeldClass({}, { width: 3 })
    expect(className.split(' ')).toHaveLength(1)
    expect(sheet.rules.at(-1)).toBe(`.${className}{color:var(--e-palette-primary);width:3px;}`)
    ;(hold as () => () => void)()()
    vi.runAllTimers()
    expect(sheet.rules.some((rule) => rule.includes(className))).toBe(false)
  })
})
