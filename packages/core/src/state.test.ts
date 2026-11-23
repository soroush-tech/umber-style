import { at } from './at'
import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { compileRules, type StyleObject } from './serialize'
import { readState, state, STATE_SELECTORS, type StateName } from './state'

const base = { palette: { primary: '#0000ff' } }
const dark = { palette: { primary: '#8888ff' } }
const NAMES: StateName[] = ['hovered', 'pressed', 'focused', 'disabled']

/** An engine over a sheet of its own, so that the rules of each form can be read apart. */
function setup() {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'e', sheet })
  return { engine: createEngine(base, { prefix: 'e', cache }), sheet }
}

/** The class and the rules of `style`, written by a fresh engine. */
function writeStyle(style: StyleObject) {
  const { engine, sheet } = setup()
  const className = engine.css(style as Parameters<typeof engine.css>[0])
  return { className, rules: [...sheet.rules] }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('state()', () => {
  it('names each state with one key, which readState reads back', () => {
    expect(NAMES.map((name) => state(name))).toEqual([
      '@state hovered',
      '@state pressed',
      '@state focused',
      '@state disabled',
    ])
    for (const name of NAMES) expect(readState(state(name))).toBe(name)
  })

  it('reads no state from another key, or from a state key with another name', () => {
    expect(readState('&:active')).toBeUndefined()
    expect(readState('@scheme dark')).toBeUndefined()
    expect(readState('@state pressd')).toBeUndefined()
    expect(readState('@state toString')).toBeUndefined()
  })

  it('warns once, in development, about a name that is not a state', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(state('pressd' as StateName)).toBe('@state pressd')
    expect(warn).not.toHaveBeenCalled()
    vi.stubEnv('NODE_ENV', 'development')
    state('pressd' as StateName)
    state('pressd' as StateName)
    state('pressed')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe(
      '[umber-style] state("pressd") names no state: the states are hovered, pressed, focused and disabled. Its key matches nothing: the web writes it as an at-rule that the browser drops, and React Native drops it.'
    )
  })
})

describe('a state key on the web', () => {
  it('is the selector written by hand for it', () => {
    expect(STATE_SELECTORS).toEqual({
      hovered: '&:hover',
      pressed: '&:active',
      focused: '&:focus-visible',
      disabled: '&:disabled, &[aria-disabled="true"]',
    })
  })

  it('gives the same rules, the same class and the same order as the selector key, for each state', () => {
    for (const name of NAMES) {
      const byKey = writeStyle({ opacity: 1, ...at(state(name), { opacity: 0.5 }), margin: 0 })
      const byHand = writeStyle({
        opacity: 1,
        [STATE_SELECTORS[name]]: { opacity: 0.5 },
        margin: 0,
      })
      expect(byKey).toEqual(byHand)
      expect(byKey.rules.length).toBeGreaterThan(0)
    }
  })

  it('writes the rule text an author gets from the selectors', () => {
    const style = {
      opacity: 1,
      ...at(state('hovered'), { opacity: 0.9 }),
      ...at(state('pressed'), { opacity: 0.7 }),
      ...at(state('focused'), { outlineWidth: 2 }),
      ...at(state('disabled'), { opacity: 0.4 }),
    }
    expect(compileRules('.x', style)).toEqual([
      '.x{opacity:1;}',
      '.x:hover{opacity:0.9;}',
      '.x:active{opacity:0.7;}',
      '.x:focus-visible{outline-width:2px;}',
      '.x:disabled,.x[aria-disabled="true"]{opacity:0.4;}',
    ])
  })

  it('nests and combines with conditions, media keys, selectors and other states as selectors do', () => {
    const { engine } = setup()
    const nested = (pressed: string, disabled: string) => ({
      [engine.when(dark)]: { [pressed]: { opacity: 0.5 } },
      '@media (min-width: 600px)': { [disabled]: { opacity: 0.3 } },
      [engine.whenScheme('dark')]: { [pressed]: { [disabled]: { opacity: 0.2 } } },
      '& svg': { [pressed]: { fill: 'red' } },
    })
    const byKey = writeStyle(nested(state('pressed'), state('disabled')))
    const byHand = writeStyle(nested(STATE_SELECTORS.pressed, STATE_SELECTORS.disabled))
    expect(byKey).toEqual(byHand)
    expect(byKey.rules.join('')).toContain(
      ':active:disabled,.' // the pressed part inside the disabled one, inside the scheme
    )
  })

  it('writes a state key with an unknown name as an at-rule, as any other unknown at-rule', () => {
    expect(compileRules('.x', { '@state pressd': { opacity: 1 } })).toEqual([
      '@state pressd{.x{opacity:1;}}',
    ])
  })
})
