import { createCache, createMemorySheet, type CacheOptions } from './cache'
import { createEngine } from './createEngine'
import type { StyleInput } from './types'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

function setup(options: CacheOptions = {}) {
  const sheet = createMemorySheet()
  const cache = createCache({ hasLayers: false, hasPruning: false, prefix: 'r', sheet, ...options })
  const engine = createEngine(theme, { prefix: 'r', cache })
  const ruleOf = (className: string) =>
    sheet.rules.find((rule) => rule.startsWith(`.${className}{`))
  return { engine, sheet, ruleOf }
}

const asStyles = (...styles: unknown[]) => styles as StyleInput[]
const sizeStyle = ({ size = 40 }: { size?: number }) => ({ width: size, height: size })

describe('the label option', () => {
  it('is the label of the class as it is written, over name and slot', () => {
    const { engine } = setup()
    const labelled = engine.createStyler({ label: 'AlertIcon' }, [{ color: 'red' }])
    expect(labelled.getClassName({})).toMatch(/^r-AlertIcon-[a-z0-9]+$/)
    const both = engine.createStyler({ name: 'Alert', slot: 'icon', label: 'AlertIcon' }, [
      { color: 'red' },
    ])
    expect(both.getClassName({})).toBe(labelled.getClassName({}))
  })

  it('labels the props class too, and is left out of the name without hasLabels', () => {
    const { engine } = setup()
    const styler = engine.createStyler({ label: 'Avatar' }, asStyles(sizeStyle))
    expect(styler.getClassName({ size: 80 })).toMatch(/^r-Avatar-[a-z0-9]+$/)
    const plain = setup({ hasLabels: false }).engine.createStyler({ label: 'Avatar' }, [
      { color: 'red' },
    ])
    expect(plain.getClassName({})).toMatch(/^r-[a-z0-9]+$/)
  })
})

describe('a style function that returns a list', () => {
  it('merges the list in order, as if its items were separate styles, nested lists and nothing included', () => {
    const { engine, ruleOf } = setup()
    const card = engine.css({ padding: 8 })
    const listed = engine.createStyler(
      {},
      asStyles(({ isOn }: { isOn?: boolean }) => [
        { color: 'red', margin: 1 },
        [null, isOn && { color: 'blue' }, [undefined, card]],
        false,
      ])
    )
    const on = listed.getClassName({ isOn: true })
    expect(ruleOf(on)).toBe(`.${on}{margin:1px;color:blue;padding:8px;}`)
    expect(on).toBe(engine.css({ color: 'red', margin: 1 }, { color: 'blue' }, card))
    const off = listed.getClassName({ isOn: false })
    expect(ruleOf(off)).toBe(`.${off}{color:red;margin:1px;padding:8px;}`)
  })

  it('goes into the base class when it reads only the theme, and the props class follows it', () => {
    const { engine, ruleOf } = setup({ hasLayers: true })
    const styler = engine.createStyler(
      {},
      asStyles(
        ({ theme: view }: { theme: typeof theme }) => [{ color: view.palette.primary }, []],
        sizeStyle
      )
    )
    const [base, props] = styler.getClassName({ size: 80 }).split(' ')
    expect(ruleOf(base)).toBeUndefined()
    expect(styler.getClassName({ size: 40 }).split(' ')[0]).toBe(base)
    expect(props).toMatch(/^r-/)
  })

  it('leaves an empty list at the end of the base out, as it leaves out an empty object', () => {
    const { engine } = setup({ hasLayers: true })
    const withList = engine.createStyler(
      {},
      asStyles({ color: 'red' }, () => [[{}]], sizeStyle)
    )
    const withObject = engine.createStyler(
      {},
      asStyles({ color: 'red' }, () => ({}), sizeStyle)
    )
    expect(withList.getClassName({ size: 8 })).toBe(withObject.getClassName({ size: 8 }))
  })

  it('makes one class without hasBaseClass, and a class for each list it returns', () => {
    const { engine, ruleOf } = setup({ hasBaseClass: false })
    const styler = engine.createStyler(
      {},
      asStyles(({ tone }: { tone: string }) => [{ color: tone }, [{ margin: 0 }]])
    )
    const red = styler.getClassName({ tone: 'red' })
    const blue = styler.getClassName({ tone: 'blue' })
    expect(red).not.toBe(blue)
    expect(ruleOf(red)).toBe(`.${red}{color:red;margin:0;}`)
    expect(ruleOf(blue)).toBe(`.${blue}{color:blue;margin:0;}`)
  })
})

describe('a later style that names a property with no value', () => {
  it('keeps the earlier declaration: undefined declares nothing', () => {
    const { engine, ruleOf } = setup()
    const styler = engine.createStyler(
      {},
      asStyles(sizeStyle, () => ({ width: undefined }))
    )
    const large = styler.getClassName({ size: 80 })
    expect(ruleOf(large)).toBe(`.${large}{width:80px;height:80px;}`)
    expect(styler.getClassName({ size: 40 })).not.toBe(large)
  })

  it('keeps the earlier declaration after a function that spreads its props', () => {
    const { engine, ruleOf } = setup()
    const spreads = (props: object) => {
      const copy = { ...props }
      return Object.keys(copy).length > 0 ? {} : null
    }
    const styler = engine.createStyler({}, asStyles(sizeStyle, spreads))
    const large = styler.getClassName({ size: 80 })
    expect(ruleOf(large)).toBe(`.${large}{width:80px;height:80px;}`)
    expect(styler.getClassName({ size: 40 })).not.toBe(large)
  })
})

describe('what a style function returns that is not a style', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('is warned about in development, once for each message, lists walked', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { engine } = setup()
    const styler = engine.createStyler(
      { label: 'Odd' },
      asStyles(({ kind }: { kind: number }) => [{ color: 'red' }, kind, [true, () => null]])
    )
    styler.getClassName({ kind: 1 })
    styler.getClassName({ kind: 1 })
    styler.getClassName({ kind: 2 })
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[r] A style function of "Odd" returned 1, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
      '[r] A style function of "Odd" returned true, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
      '[r] A style function of "Odd" returned a function, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
      '[r] A style function of "Odd" returned 2, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
    ])
  })

  it('is warned about for a function of the theme alone, in the base class, with no label', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { engine } = setup({ hasLayers: true })
    const styler = engine.createStyler(
      {},
      asStyles(() => 'a-class', sizeStyle)
    )
    expect(styler.getClassName({ size: 1 }).split(' ')[0]).toBe('a-class')
    expect(warn).toHaveBeenCalledWith(
      '[r] A style function returned "a-class", which is not a style: return a style object, a css() value, a list of them, null, undefined or false.'
    )
  })

  it('is warned about in a test run with hasDevChecks, of the engine or of its cache, and not with it off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const own = createEngine(theme, { prefix: 'dc', hasDevChecks: true })
    own
      .createStyler(
        {},
        asStyles(() => 7)
      )
      .getClassName({})
    const { engine } = setup({ hasDevChecks: true })
    engine
      .createStyler(
        {},
        asStyles(() => 8)
      )
      .getClassName({})
    vi.stubEnv('NODE_ENV', 'development')
    const off = createEngine(theme, { prefix: 'off', hasDevChecks: false })
    off
      .createStyler(
        {},
        asStyles(() => 9)
      )
      .getClassName({})
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[dc] A style function returned 7, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
      '[r] A style function returned 8, which is not a style: return a style object, a css() value, a list of them, null, undefined or false.',
    ])
  })

  it('is not warned about outside development: a string is a class name, and the rest is left out', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { engine, ruleOf } = setup()
    const styler = engine.createStyler(
      {},
      asStyles(() => [null, 'x', 1, true, { color: 'red' }])
    )
    const [name, own] = styler.getClassName({}).split(' ')
    expect(name).toBe('x')
    expect(ruleOf(own)).toBe(`.${own}{color:red;}`)
    expect(warn).not.toHaveBeenCalled()
  })
})
