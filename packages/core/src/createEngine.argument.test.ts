import { types } from 'node:util'
import { createCache, createMemorySheet } from './cache'
import { createEngine } from './createEngine'
import { globalStyles } from './globalStyles'
import { keyframes } from './keyframes'
import type { StyleInput } from './types'

const theme = { palette: { primary: '#0000ff', text: '#111111' }, space: [0, 4, 8] }
type AppTheme = typeof theme
type Argument = Record<string, unknown> & { theme: AppTheme }

/** An engine over a sheet in memory, with the development checks on or off, and its options. */
function setup(hasDevChecks: boolean, hasBaseClass = true) {
  const sheet = createMemorySheet()
  const cache = createCache({ prefix: 'ar', sheet, hasLayers: false, hasPruning: false })
  const engine = createEngine(theme, { cache, hasDevChecks, hasBaseClass })
  return { engine, sheet }
}

const asStyles = (...styles: unknown[]) => styles as StyleInput[]

describe('the argument of the style functions of one element', () => {
  it('is one object for every function of the element in a render, and another in the next render', () => {
    for (const hasDevChecks of [false, true]) {
      const seen: unknown[] = []
      const { engine } = setup(hasDevChecks)
      const styler = engine.createStyler(
        { label: 'Box' },
        asStyles(
          (argument: Argument) => {
            seen.push(argument)
            return { color: argument.tone as string }
          },
          { margin: 1 },
          (argument: Argument) => {
            seen.push(argument)
            return { padding: argument.theme.space[1] }
          }
        )
      )
      styler.getClassName({ tone: 'red' })
      const first = seen.length
      styler.getClassName({ tone: 'red' })
      styler.getClassName({ tone: 'blue' })
      const renders = [seen.slice(first, first + 2), seen.slice(first + 2)]
      for (const [one, other] of renders) expect(one).toBe(other)
      expect(renders[0][0]).not.toBe(renders[1][0])
      expect(Object.isFrozen(renders[0][0])).toBe(hasDevChecks)
    }
  })

  it('is one object in the render that plans the base too, given to every function there', () => {
    const seen: unknown[] = []
    const { engine } = setup(true)
    const styler = engine.createStyler(
      { label: 'Box' },
      asStyles(
        (argument: Argument) => {
          seen.push(argument)
          return { color: argument.theme.palette.primary }
        },
        (argument: Argument) => {
          seen.push(argument)
          return { padding: argument.theme.space[1] }
        },
        (argument: Argument) => ({ margin: argument.gap as number })
      )
    )
    styler.getClassName({ gap: 2 })
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })

  it('in development, throws when a function assigns or deletes a key, naming the component', () => {
    const { engine } = setup(true, false)
    const writer = engine.createStyler(
      { label: 'Box' },
      asStyles((argument: Argument) => {
        argument.tone = 'red'
        return { color: 'red' }
      })
    )
    expect(() => writer.getClassName({})).toThrow(
      new TypeError(
        `[ar] A style function of "Box" threw a TypeError of a write into a frozen object: Cannot add property tone, object is not extensible. In development the argument of a style function is frozen: it is one object, the props with the theme, shared by the style functions of the element in a render. Copy the argument before changing it: const own = { ...props }.`
      )
    )
    const remover = engine.createStyler(
      {},
      asStyles((argument: Argument) => {
        delete argument.tone
        return null
      })
    )
    expect(() => remover.getClassName({ tone: 'red' })).toThrow(
      /^\[ar\] A style function threw a TypeError of a write into a frozen object: Cannot delete property 'tone'/
    )
  })

  it('in development, throws from the render that plans the base, and keeps any other error as it is', () => {
    const { engine } = setup(true)
    const writer = engine.createStyler(
      { label: 'Box' },
      asStyles((argument: Argument) => {
        argument.theme = theme
        return { color: 'red' }
      })
    )
    expect(() => writer.getClassName({})).toThrow(/A style function of "Box" threw a TypeError/)
    const failure = new RangeError('no size')
    const other = engine.createStyler(
      {},
      asStyles(() => {
        throw failure
      })
    )
    expect(() => other.getClassName({})).toThrow(failure)
  })

  it('in production, is not frozen: a change is seen by the later functions, and the classes are those of a copy', () => {
    const { engine, sheet } = setup(false)
    const writer = engine.createStyler(
      { label: 'Box' },
      asStyles(
        (argument: Argument) => {
          argument.tone = 'red'
          return null
        },
        (argument: Argument) => ({ color: argument.tone as string })
      )
    )
    const copier = engine.createStyler(
      { label: 'Box' },
      asStyles(
        () => null,
        (argument: Argument) => ({ color: { ...argument, tone: 'red' }.tone })
      )
    )
    expect(writer.getClassName({})).toBe(copier.getClassName({}))
    expect(sheet.rules.filter((rule) => rule.includes('color:red'))).toHaveLength(1)
  })

  it('gives the same classes and rules with the checks on and off', () => {
    const styles = asStyles(
      { display: 'flex' },
      ({ theme: view }: Argument) => ({ color: view.palette.primary }),
      ({ gap }: Argument) => ({ gap: gap as number })
    )
    const [on, off] = [true, false].map((hasDevChecks) => {
      const { engine, sheet } = setup(hasDevChecks)
      const styler = engine.createStyler({ label: 'Row' }, styles)
      const names = [styler.getClassName({ gap: 1 }), styler.getClassName({ gap: 2 })]
      return { names, rules: sheet.rules }
    })
    expect(on).toEqual(off)
  })
})

describe('the theme that a function of app code gets', () => {
  it('in development, throws on a write at any level from a style function, naming the path and the component', () => {
    const { engine } = setup(true, false)
    const writes: [string, (view: AppTheme) => void][] = [
      [
        'theme.palette.primary is set',
        (view) => {
          view.palette.primary = 'red'
        },
      ],
      [
        'theme.palette is set',
        (view) => {
          view.palette = { primary: 'red', text: 'red' }
        },
      ],
      [
        'theme.palette.text is deleted',
        (view) => {
          delete (view.palette as Partial<AppTheme['palette']>).text
        },
      ],
      [
        'theme.space.1 is defined',
        (view) => {
          Object.defineProperty(view.space, '1', { value: 2 })
        },
      ],
    ]
    for (const [what, write] of writes) {
      const styler = engine.createStyler(
        { label: 'Card' },
        asStyles(({ theme: view }: Argument) => {
          write(view)
          return null
        })
      )
      expect(() => styler.getClassName({})).toThrow(`[ar] ${what} by a function of "Card".`)
    }
    expect(theme.palette).toEqual({ primary: '#0000ff', text: '#111111' })
  })

  it('in development, says what to do instead, and names no component for a style function without a label', () => {
    const { engine } = setup(true, false)
    const styler = engine.createStyler(
      {},
      asStyles(({ theme: view }: Argument) => {
        ;(view as unknown as Record<string, unknown>).mode = 'dark'
        return null
      })
    )
    expect(() => styler.getClassName({})).toThrow(
      new TypeError(
        '[ar] theme.mode is set by a function. The theme is one object, shared by every render and every request, so a change to it reaches all of them: never change it. Build a new object instead, such as { ...theme, mode: value }.'
      )
    )
  })

  it('in development, throws from a function of global styles, of keyframes and of a sheet', () => {
    const { engine } = setup(true)
    const global = globalStyles((view: AppTheme) => {
      view.palette.text = 'red'
      return { body: { margin: 0 } }
    })
    expect(() => engine.resolveGlobal(global)).toThrow(
      '[ar] theme.palette.text is set by a function of "Global".'
    )
    expect(() =>
      engine.resolveGlobal((view: AppTheme) => {
        delete (view as Partial<AppTheme>).space
        return null
      })
    ).toThrow('[ar] theme.space is deleted by a function of "Global".')
    // At registration the function gets a stand-in, which takes the write: the name is made from it.
    const spin = keyframes(
      (view: AppTheme) => {
        view.space[0] = 1
        return { to: { opacity: 1 } }
      },
      { label: 'spin' }
    )
    expect(() => engine.insertKeyframes(spin)).toThrow(
      `[ar] theme.space.0 is set by a function of "keyframes ${spin}".`
    )
    const sheet = engine.createSheet((view: AppTheme) => {
      view.palette.primary = 'red'
      return { root: {} }
    })
    expect(() => sheet.resolve()).toThrow(
      '[ar] theme.palette.primary is set by a function of "StyleSheet".'
    )
    expect(() => sheet.resolve(engine.createThemeView({ ...theme }))).toThrow(
      'is set by a function of "StyleSheet".'
    )
    expect(() => engine.guardTheme(theme, 'ThemeProvider').palette.primary.length).not.toThrow()
    expect(() => {
      engine.guardTheme(theme, 'ThemeProvider').space.push(1)
    }).toThrow('[ar] theme.space.3 is set by a function of "ThemeProvider".')
  })

  it('in development, gives the same wrapper of a member for the same function across renders', () => {
    const { engine } = setup(true)
    const seen: unknown[] = []
    const styler = engine.createStyler(
      { label: 'Card' },
      asStyles(({ theme: view, size }: Argument) => {
        seen.push(view, view.palette)
        return { padding: size as number }
      })
    )
    styler.getClassName({ size: 1 })
    styler.getClassName({ size: 2 })
    expect(seen.at(-2)).toBe(seen[0])
    expect(seen.at(-1)).toBe(seen[1])
    expect(types.isProxy(seen[1])).toBe(true)
  })

  it('in production, is the theme itself, with no wrapper: a write goes through', () => {
    const { engine, sheet } = setup(false)
    const seen: unknown[] = []
    const local = { palette: { primary: '#0000ff' } }
    const note = (view: AppTheme) => {
      seen.push(view)
      return { body: { margin: 0 } }
    }
    const global = globalStyles(note)
    const fade = keyframes(
      (view: AppTheme) => {
        seen.push(view)
        return { to: { opacity: 0.5 } }
      },
      { label: 'fade' }
    )
    // The stand-ins that named the two handles are not the theme.
    seen.length = 0
    engine.resolveGlobal(global)
    engine.resolveGlobal(global, local as AppTheme)
    engine.insertKeyframes(fade)
    engine.createSheet((view: AppTheme) => note(view) && { root: {} }).resolve()
    expect(engine.guardTheme(local, 'ThemeProvider')).toBe(local)
    const { refs } = engine
    expect(seen).toHaveLength(4)
    for (const [index, view] of seen.entries()) expect(view).toBe(index === 1 ? local : refs)
    expect(sheet.rules.some((rule) => rule.startsWith(`@keyframes ${fade}{`))).toBe(true)
    const writer = engine.createStyler(
      {},
      asStyles(({ theme: view }: Argument) => {
        ;(view.palette as Record<string, string>).extra = 'x'
        return null
      })
    )
    expect(() => writer.getClassName({})).not.toThrow()
    expect((refs.palette as Record<string, string>).extra).toBe('x')
  })
})
