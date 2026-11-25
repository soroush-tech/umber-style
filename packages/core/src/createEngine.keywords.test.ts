import { createCache, createMemorySheet } from './cache'
import { createEngine, createLazyEngine } from './createEngine'
import type { EngineOptions } from './types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** An engine of `theme` with the development checks, over a memory sheet. */
function setup<T extends object>(theme: T, options: EngineOptions = {}) {
  const cache = createCache({ prefix: 'k', sheet: createMemorySheet(), hasDevChecks: true })
  return createEngine(theme, { cache, ...options })
}

/** What the warning for the token at `path` says. */
const message = (path: string, keyword: string, name: string) =>
  `[k] The token "${path}" is the CSS-wide keyword ${keyword}, which a variable takes as itself: ${name}: ${keyword} makes var(${name}) the value of ${name} on the parent (often nothing), so a property that does not inherit, such as background-color, gets its initial value, and only one that inherits, such as color, seems to work. Write ${keyword} in the style itself, or give the path the mode raw (modes: { '${path}': 'raw' }) so that a style gets the keyword as it is.`

describe('a token whose value is a CSS-wide keyword', () => {
  it.each(['inherit', 'initial', 'unset', 'revert', 'revert-layer'])(
    'is warned about once for its path: %s',
    (keyword) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const theme = { text: { inherit: keyword, primary: '#111111' } }
      const engine = setup(theme)
      engine.declareRoot(theme)
      engine.themeClass({ text: { inherit: keyword } })
      expect(warn.mock.calls).toEqual([[message('text.inherit', keyword, '--k-text-inherit')]])
    }
  )

  it('is found in any letter case and with white space around it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const engine = setup({ a: ' Inherit ', b: 'REVERT-LAYER', c: 'inherited', d: 'unset 1', e: 0 })
    expect(engine.refs.a).toBe('var(--k-a)')
    expect(warn.mock.calls).toEqual([
      [message('a', 'inherit', '--k-a')],
      [message('b', 'revert-layer', '--k-b')],
    ])
  })

  it('is warned about in a theme other than the base one, by the path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const engine = setup({ text: { muted: '#666666' } })
    expect(warn).not.toHaveBeenCalled()
    engine.themeClass({ text: { muted: 'initial' } })
    engine.readThemeText({ text: { muted: 'initial' } })
    expect(warn.mock.calls).toEqual([[message('text.muted', 'initial', '--k-text-muted')]])
  })

  it('is warned about with no base theme, where the text of a theme is read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'k', sheet: createMemorySheet(), hasDevChecks: true })
    const engine = createLazyEngine<{ text: { muted: string } }>({ cache })
    engine.readThemeText({ text: { muted: 'unset' } })
    engine.createThemeView({ text: { muted: 'unset' } })
    expect(warn.mock.calls).toEqual([[message('text.muted', 'unset', '--k-text-muted')]])
  })

  it('is not warned about in a raw or an inline mode, whose value is no variable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const theme = { text: { inherit: 'inherit' }, color: { current: 'inherit' } }
    const engine = setup(theme, { modes: { 'text.inherit': 'raw', color: 'inline' } })
    engine.declareRoot(theme)
    expect(engine.refs.text.inherit).toBe('inherit')
    expect(warn).not.toHaveBeenCalled()
  })

  it('is not warned about without the development checks', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const theme = { text: { inherit: 'inherit' } }
    const cache = createCache({ prefix: 'k', sheet: createMemorySheet() })
    createEngine(theme, { cache }).declareRoot(theme)
    expect(warn).not.toHaveBeenCalled()
  })
})
