import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'

const theme = {
  layout: { margin: 2 },
  space: [0, 4, 8],
  typography: { h1: { fontSize: 'lg' } },
  sizes: { lg: '2rem' },
  breakpoints: Object.freeze({ values: Object.freeze({ md: 768 }) }),
}
type AppTheme = typeof theme

/** An engine over a sheet in memory, with the development checks on or off. */
function setup(hasDevChecks: boolean) {
  const cache = createCache({ prefix: 'rk', sheet: createMemorySheet(), hasLayers: false })
  return createEngine(theme, { cache, hasDevChecks })
}

describe('a token reference used as a key of the theme view', () => {
  it('is warned about once with the development checks, naming the key, the path, the token and the label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const engine = setup(true)
    const styler = engine.createStyler({ label: 'Box' }, [
      ({ theme: view }: { theme: AppTheme }) => ({
        margin: view.space[view.layout.margin as unknown as number],
      }),
      ({ theme: view, isBig }: { theme: AppTheme; isBig?: boolean }) => ({
        fontSize: (view.sizes as Record<string, string>)[view.typography.h1.fontSize],
        padding: isBig ? view.space[1] : 0,
      }),
    ])
    styler.getClassName({})
    styler.getClassName({ isBig: true })
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      `[rk] A style function of "Box" reads theme.space[var(--rk-layout-margin)]: var(--rk-layout-margin) is a token reference, not the value of the token, so the lookup gives undefined. Give "layout.margin" a raw mode (modes: { 'layout.margin': 'raw' }), or read the real value from useTheme().`,
      `[rk] A style function of "Box" reads theme.sizes[var(--rk-typography-h1-font-size)]: var(--rk-typography-h1-font-size) is a token reference, not the value of the token, so the lookup gives undefined. Give "typography.h1.fontSize" a raw mode (modes: { 'typography.h1.fontSize': 'raw' }), or read the real value from useTheme().`,
    ])
    warn.mockRestore()
  })

  it('names the theme itself and a reference that is no token, with no label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const engine = setup(true)
    const styler = engine.createStyler({}, [
      ({ theme: view }: { theme: Record<string, unknown> }) => ({
        color: view['var(--rk-gone)'] as string,
        top: (view.breakpoints as { values: { md: number } }).values.md,
      }),
    ])
    styler.getClassName({})
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      `[rk] A style function reads theme[var(--rk-gone)]: var(--rk-gone) is a token reference, not the value of the token, so the lookup gives undefined. Give the token a raw mode (modes: { '<path>': 'raw' }), or read the real value from useTheme().`,
    ])
    warn.mockRestore()
  })

  it('costs nothing without the checks: a style function gets the view itself, no wrapper', () => {
    const engine = setup(false)
    const seen: unknown[] = []
    const styler = engine.createStyler({ label: 'Box' }, [
      ({ theme: view }: { theme: AppTheme }) => {
        seen.push(view, view.space)
        return { margin: 0 }
      },
      ({ theme: view, isBig }: { theme: AppTheme; isBig?: boolean }) => {
        seen.push(view, view.space)
        return { padding: isBig ? 1 : 0 }
      },
    ])
    styler.getClassName({ isBig: true })
    const { refs } = engine
    expect(seen.length).toBeGreaterThanOrEqual(4)
    for (const [index, value] of seen.entries()) {
      expect(value).toBe(index % 2 === 0 ? refs : refs.space)
    }
  })
})
