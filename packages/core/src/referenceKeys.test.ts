import { types } from 'node:util'
import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { createReferenceGuard, createThemeGuard } from './referenceKeys'

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

describe('a write into a guarded theme', () => {
  const guard = createThemeGuard('[g] ')

  it('throws at the top level and at every level below, naming the path, the label and the advice', () => {
    const source = { palette: { primary: 'blue' }, space: [0, 4], nested: { deep: { value: 1 } } }
    const view = guard(source, 'Box')
    expect(() => {
      ;(view as Record<string, unknown>).mode = 'dark'
    }).toThrow(
      new TypeError(
        '[g] theme.mode is set by a function of "Box". The theme is one object, shared by every render and every request, so a change to it reaches all of them: never change it. Build a new object instead, such as { ...theme, mode: value }.'
      )
    )
    expect(() => {
      view.nested.deep.value = 2
    }).toThrow('[g] theme.nested.deep.value is set by a function of "Box".')
    expect(() => {
      delete (view.palette as Partial<typeof source.palette>).primary
    }).toThrow('[g] theme.palette.primary is deleted by a function of "Box".')
    expect(() => Object.defineProperty(view.space, '0', { value: 1 })).toThrow(
      '[g] theme.space.0 is defined by a function of "Box".'
    )
    expect(() => {
      view.space.push(8)
    }).toThrow('[g] theme.space.2 is set by a function of "Box".')
    expect(() => {
      delete (guard(source, '') as Partial<typeof source>).space
    }).toThrow('[g] theme.space is deleted by a function. ')
    expect(source).toEqual({
      palette: { primary: 'blue' },
      space: [0, 4],
      nested: { deep: { value: 1 } },
    })
  })

  it('reads as the theme does, the same wrapper for the same object and label, and gives other objects as they are', () => {
    const when = new Date(0)
    const sizes = new Map([['md', 768]])
    const helper = () => 'x'
    const source = {
      palette: { primary: 'blue' },
      when,
      sizes,
      helper,
      frozen: Object.freeze({ a: 1 }),
    }
    const view = guard(source, 'Box')
    expect(view.palette.primary).toBe('blue')
    expect(view.palette).toBe(view.palette)
    expect(guard(source, 'Box')).toBe(view)
    expect(guard(source, 'Card')).not.toBe(view)
    expect(types.isProxy(view.palette)).toBe(true)
    expect(view.when).toBe(when)
    expect(view.when.getTime()).toBe(0)
    expect(view.sizes.get('md')).toBe(768)
    expect(view.helper).toBe(helper)
    expect(view).toEqual(source)
    expect({ ...view.palette }).toEqual({ primary: 'blue' })
  })

  it('warns about a token reference read through the reference guard and throws on a write through it', () => {
    const warn = vi.fn()
    const guarded = createReferenceGuard(
      'rk',
      () => ({ layout: { margin: 'var(--rk-layout-margin)' } }),
      warn
    )({ space: { a: 1 } }, 'Box') as { space: Record<string, number> }
    expect(guarded.space['var(--rk-layout-margin)']).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(() => {
      guarded.space.a = 2
    }).toThrow('[rk] theme.space.a is set by a function of "Box".')
  })
})
