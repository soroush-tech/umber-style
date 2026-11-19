import { createCache, type Cache, type ClassValue } from './cache'
import { createSheetEntry, type SheetEntry } from './sheetEntry'
import { createThemeClass } from './theme'
import { createTokens, type DeepPartial, type Tokens } from './tokens'
import type { WebStyleObject } from './webStyle'
import type {
  ColorScheme,
  EngineOptions,
  SheetInput,
  SheetStyles,
  StyleFunction,
  StyleInput,
  StylerOptions,
  StyleResult,
  Theme,
} from './types'

/** What is thrown when something needs the shape of the theme before any theme is known. */
export const NO_THEME_MESSAGE =
  'There is no theme yet: render a ThemeProvider with the full theme first, or call setTheme (or configure({ theme })) before a function style, a sheet or useTheme is used.'

/** The options of a binding's `createStyle`: those of the engine, or an engine to share with other bindings. */
export interface BindingOptions<T> extends EngineOptions {
  /** When given, the engine options are not used. */
  engine?: Engine<T>
}

export interface Styler {
  /** The full style list, for a component that wraps this one. */
  styles: readonly StyleInput[]
  /** Whether a style is a function: only then the class depends on the props and the theme. */
  isDynamic: boolean
  /**
   * The class names for these props and what comes in after the styles (sheet entries, plain objects,
   * a className). With layers: the component class (the styles, in the `components` layer) and, only
   * when something comes in, one override class (all of it merged in order, the last winning, in the
   * `overrides` layer); foreign class names pass through. Without layers: one merged class.
   */
  getClassName(
    props: Record<string, unknown>,
    extra?: ClassValue | readonly ClassValue[],
    theme?: unknown
  ): string
}

export interface Engine<T> {
  cache: Cache
  /** Whether a base theme is known: it is given by `setTheme`, or by the first `themeClass`. */
  readonly hasTheme: boolean
  /** The base theme, the real values, or undefined while there is none. */
  readonly baseTheme: T | undefined
  /** The view of the base theme: its shape, with a var(--name) reference for each token. Throws while there is no theme. */
  readonly refs: T
  /** The view of `realTheme`: each token is a var(--name) reference, every other part (breakpoints, functions, other objects) is taken from `realTheme`. Made once for each theme object. */
  createThemeView(realTheme: T): T
  /** Gives the engine its base theme. The same object again does nothing; another one replaces the base. */
  setTheme(theme: T): void
  css: Cache['css']
  /** The scope class of a theme, made once for each theme object and color scheme. With no base theme yet, this theme becomes it. */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** The class of a wrapper that a provider renders: it only has display: contents. Inserted once. It is not part of a theme class, which is also put on <html>. */
  scopeClass(): string
  /** The class name of each key of a sheet, made on first use. */
  createSheet<K extends string>(
    styles: SheetInput<K, T>
  ): {
    /** Whether the styles are a function of the theme. */
    isDynamic: boolean
    /** The entries; for a function, against `theme` (a theme view) when given, else against the base theme. */
    resolve(theme?: T): { [P in K]: SheetEntry }
  }
  /** The logic that every web `styled` shares: the label, the style list, function styles and the class memo. */
  createStyler(
    options: StylerOptions,
    styles: readonly StyleInput[],
    inherited?: readonly StyleInput[]
  ): Styler
}

/** `text` in kebab-case: ButtonBase gives button-base. */
function toKebabCase(text: string): string {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** The label of a styled component: `name-slot`, or '' without a name. */
function createLabel({ name, slot = 'root' }: StylerOptions): string {
  return name ? `${toKebabCase(name)}-${toKebabCase(slot)}` : ''
}

/** Makes an engine that has no theme yet: it takes one from `setTheme`, or from the first `themeClass`. It needs no framework. */
export function createLazyEngine<T extends object = Theme>(options: EngineOptions = {}): Engine<T> {
  const { cache: given, suffix, hasLabels, hasLayers, hasPruning, hasColorFallbacks } = options
  const { alwaysDeclare = [] } = options
  const { rawKeys, lengthKeys, modes, registered } = options
  const prefix = options.prefix ?? given?.prefix ?? 'css'
  const cache =
    given ?? createCache({ prefix, suffix, hasLabels, hasLayers, hasPruning, hasColorFallbacks })
  const tokenOptions = { prefix, rawKeys, lengthKeys, modes, registered }
  let baseTheme: T | undefined
  let tokens: Tokens<T> | undefined
  // Counts the base themes, so that a sheet made from a function is made again for a new one.
  let version = 0

  const readTokens = (): Tokens<T> => {
    if (!tokens) throw new Error(NO_THEME_MESSAGE)
    return tokens
  }

  const setTheme = (theme: T) => {
    if (theme === baseTheme) return
    baseTheme = theme
    tokens = createTokens(theme, tokenOptions)
    views = new WeakMap()
    // A registered variable gets its @property rule when a rule first uses it.
    cache.registerProperties(tokens.registrations)
    // Variables that code outside the engine reads are always declared.
    cache.markUsed(tokens.findNames(alwaysDeclare))
    version++
  }

  // A view keeps the base value as the fallback of a reference token, so a new base makes new views.
  let views = new WeakMap<object, T>()
  const createThemeView = (realTheme: T): T => {
    let view = views.get(realTheme)
    if (view === undefined) {
      view = (tokens ?? createTokens(realTheme, tokenOptions)).createView(realTheme)
      views.set(realTheme, view)
    }
    return view
  }

  // A theme object is read once per color scheme: a theme object is not changed after it is used.
  const themeClasses = new WeakMap<object, Map<string, string>>()
  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) => {
    if (!tokens) setTheme(partial as T)
    const key = colorScheme ?? ''
    const known = themeClasses.get(partial) ?? new Map<string, string>()
    themeClasses.set(partial, known)
    let className = known.get(key)
    if (className === undefined) {
      className = createThemeClass(cache, readTokens().declare(partial), { colorScheme })
      known.set(key, className)
    }
    return className
  }

  const scopeName = `${cache.prefix}-scope`
  const scopeClass = () => {
    cache.insertOnce(scopeName, [`.${scopeName}{display:contents;}`], 'theme')
    return scopeName
  }

  const createSheet = <S extends SheetStyles>(styles: S | ((theme: T) => S)) => {
    const isDynamic = typeof styles === 'function'
    const makeClasses = (view?: T) => {
      const source = typeof styles === 'function' ? styles(view as T) : styles
      const entries = Object.entries(source).map(([key, style]) => [
        key,
        createSheetEntry(cache.css(style)),
      ])
      return Object.fromEntries(entries) as { [K in keyof S]: SheetEntry }
    }
    // The classes against the base theme are made again for a new base; those against a view are made once.
    let baseClasses: { [K in keyof S]: SheetEntry } | undefined
    let madeAt = 0
    const viewClasses = new WeakMap<object, { [K in keyof S]: SheetEntry }>()
    return {
      isDynamic,
      resolve(theme?: T) {
        if (theme !== undefined && isDynamic) {
          let classes = viewClasses.get(theme)
          if (classes === undefined) {
            classes = makeClasses(theme)
            viewClasses.set(theme, classes)
          }
          return classes
        }
        const isStale = isDynamic && madeAt !== version
        if (baseClasses === undefined || isStale) {
          baseClasses = makeClasses(isDynamic ? readTokens().refs : undefined)
          madeAt = version
        }
        return baseClasses
      },
    }
  }

  const createStyler = (
    stylerOptions: StylerOptions,
    styles: readonly StyleInput[],
    inherited: readonly StyleInput[] = []
  ): Styler => {
    const label = createLabel(stylerOptions)
    const list = [...inherited, ...(label ? [{ label }] : []), ...styles]
    const hasFunction = list.some((style) => typeof style === 'function')
    const resolveStyle = (
      style: StyleInput,
      props: Record<string, unknown>,
      theme: unknown
    ): StyleResult =>
      typeof style === 'function'
        ? (style as StyleFunction<unknown, Record<string, unknown>>)({
            ...props,
            theme: theme ?? readTokens().refs,
          })
        : style

    // Without function styles the class only changes when something comes in after the styles.
    let staticClass: string | undefined

    return {
      styles: list,
      isDynamic: hasFunction,
      getClassName(props, extra, theme) {
        const extras = Array.isArray(extra) ? extra : [extra]
        const hasExtras = extras.some(Boolean)
        const resolved = () => list.map((style) => resolveStyle(style, props, theme))
        if (!cache.hasLayers) {
          if (hasFunction) return cache.css(...resolved(), ...extras)
          if (hasExtras) return cache.css(...(list as WebStyleObject[]), ...extras)
          staticClass ??= cache.css(...(list as WebStyleObject[]))
          return staticClass
        }
        if (!hasFunction) staticClass ??= cache.css(...(list as WebStyleObject[]))
        const own = hasFunction ? cache.css(...resolved()) : (staticClass as string)
        if (!hasExtras) return own
        // The override class takes the label of the component, so that it can be told from the others.
        const overrides = cache.cssIn('overrides', ...extras, ...(label ? [{ label }] : []))
        return [own, overrides].filter(Boolean).join(' ')
      },
    }
  }

  return {
    cache,
    css: cache.css,
    get hasTheme() {
      return baseTheme !== undefined
    },
    get baseTheme() {
      return baseTheme
    },
    get refs() {
      return readTokens().refs
    },
    scopeClass,
    setTheme,
    createThemeView,
    themeClass,
    createSheet,
    createStyler,
  }
}

/** Makes the engine of one theme shape: a cache, the theme as variables, and what the bindings build on. It needs no framework. */
export function createEngine<T extends object>(theme: T, options: EngineOptions = {}): Engine<T> {
  const engine = createLazyEngine<T>(options)
  engine.setTheme(theme)
  return engine
}
