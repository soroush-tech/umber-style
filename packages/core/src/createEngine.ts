import { hashString } from './hash'
import { createLazyRecord } from './lazyRecord'
import { createCache, type Cache, type ClassValue, type GlobalRules, type HeldClass } from './cache'
import { isSheetEntry } from './sheetEntry'
import { readGlobalStyles, type GlobalInput } from './globalStyles'
import {
  createSchemeKey,
  createThemeClassName,
  createThemeKey,
  type SchemeKey,
  type SchemeName,
  type ThemeKey,
} from './scope'
import {
  keyframes,
  type KeyframesInput,
  type KeyframesOptions,
  type KeyframesSteps,
} from './keyframes'
import { isStyleFunction, splitLeading } from './styleBase'
import { isSameView } from './sameView'
import { createThemeClass, declareRootTheme } from './theme'
import { createTokens, type DeepPartial, type Tokens } from './tokens'
import type { TemplateValue } from './styleTypes'
import type { WebStyleObject } from './webStyle'
import type {
  ColorScheme,
  EngineOptions,
  ObjectSheet,
  SheetEntries,
  StyleFunction,
  StyleInput,
  StylerOptions,
  StyleResult,
  Theme,
  ThemedSheet,
} from './types'

/** Whether `sheet` is a sheet made from a function of the theme, which `resolve` turns into entries; an object sheet is its entries, none of which is a function. */
export function isThemedSheet(sheet: object): sheet is ThemedSheet<string, unknown> {
  return typeof (sheet as { resolve?: unknown }).resolve === 'function'
}

/** How many recent views a new view is compared with. */
const RECENT_VIEWS = 8

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
   * a className). With layers: the base class (the plain objects before the first function, made once)
   * and the props class (from the first function on, made for each render), both in the `components`
   * layer, base first; then, only when something comes in, one override class in the `overrides` layer
   * (all of it merged in order, the last winning; or, when it is exactly one sheet entry, the class of
   * that entry for the layer); foreign class names pass through. Without layers there is no order between
   * classes to rely on, so when something comes in all of it is merged into one class. Without
   * `hasBaseClass`: one class for the styles.
   */
  getClassName(
    props: Record<string, unknown>,
    extra?: ClassValue | readonly ClassValue[],
    theme?: unknown
  ): string
  /**
   * `getClassName` for an element that can count the classes it uses (a styled component in the
   * browser): when what comes in has a plain style object, the class it makes (the override class;
   * without layers, the one merged class) is made with `Cache.cssHeld`, and `hold` counts the element
   * that uses it. Otherwise it is `getClassName`, with no `hold`.
   */
  getHeldClass(
    props: Record<string, unknown>,
    extra?: ClassValue | readonly ClassValue[],
    theme?: unknown
  ): HeldClass
}

export interface Engine<T> {
  cache: Cache
  /** Whether a base theme is known: it is given by `setTheme`, or by the first `themeClass`. */
  readonly hasTheme: boolean
  /** The base theme, the real values, or undefined while there is none. */
  readonly baseTheme: T | undefined
  /** The view of the base theme: its shape, with a var(--name) reference for each token. Throws while there is no theme. */
  readonly refs: T
  /**
   * The view of `realTheme`: each token is a var(--name) reference, every other part (breakpoints,
   * functions, other objects) is taken from `realTheme`. Made once for each theme object; a view that is
   * the same as a recent one (themes that differ only in the values of their variables) is that one, so
   * that a component that reads the view does not render again when only variables change.
   */
  createThemeView(realTheme: T): T
  /** Gives the engine its base theme. The same object again does nothing; another one replaces the base. */
  setTheme(theme: T): void
  css: Cache['css']
  /**
   * The classes of a theme, made once for each theme object and color scheme: the theme class (the
   * variables), the boundary marker `<prefix>-boundary`, and for a `light` or `dark` color scheme the
   * marker `<prefix>-scheme-light` or `-dark`. Put the whole string where a class goes. With no base
   * theme yet, this theme becomes it.
   */
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** The theme class alone, `<prefix>-theme-<hash>`: the id that rules and style elements are keyed by. Makes the theme class as `themeClass` does. */
  themeId(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  /** The theme classes already made for this theme object (one for each color scheme it was asked with), without making any. */
  findThemeIds(theme: DeepPartial<T>): string[]
  /**
   * Declares the variables of `theme` (a whole theme, the real values) on `:root`, in the theme layer,
   * and returns the id of that rule, `<prefix>-root-<hash>`; with a `colorScheme` the rule sets it too.
   * The engine has one root theme: a call with another theme replaces the rule (see `Cache.insertRoot`).
   * Made once for each theme object and color scheme. With no base theme yet, this theme becomes it.
   */
  declareRoot(theme: T, colorScheme?: ColorScheme): string
  /** A style key for "the nearest theme is this theme": `{ [when(dark)]: { border: ... } }`. Needs `@scope` (see `hasScope`). */
  when(theme: DeepPartial<T>, colorScheme?: ColorScheme): ThemeKey
  /** A style key for "the nearest color scheme is this one": the nearest theme given that `colorScheme`, else the system preference. */
  whenScheme(scheme: SchemeName): SchemeKey
  /** The class of a wrapper that a provider renders: it only has display: contents. Inserted once. It is not part of a theme class, which is also put on <html>. */
  scopeClass(): string
  /**
   * Registers an animation and returns its name at once, before there is a theme too (see `keyframes`).
   * Its `@keyframes` rule is written once, outside every layer, when a class that uses the name in
   * `animation` or `animation-name` is first inserted; steps given as a function of the theme are then
   * resolved against `refs`.
   */
  keyframes(steps: (theme: T) => KeyframesSteps, options?: KeyframesOptions): string
  /** As a tag: the steps written as CSS text; a function among the interpolations is called with `{ theme }`. */
  keyframes(template: TemplateStringsArray, ...values: TemplateValue<unknown, T>[]): string
  keyframes(steps: KeyframesInput<T>, options?: KeyframesOptions): string
  /** Writes the `@keyframes` rule of `name` now, for a use the engine cannot see in a class (a name under another key, CSS of the app's own, the Web Animations API). Throws a `TypeError` for a name that `keyframes` did not return. */
  insertKeyframes(name: string): void
  /**
   * The rules of global styles (a handle, an object, a function of the theme, or a list of them), one set
   * for each, in the order of the list; nothing is written. A function is called with `theme` (the theme
   * view of the nearest provider) when given, else with `refs`: tokens are references either way, and
   * keys that hold real values (raw keys, the `inline` mode) come from that theme.
   */
  resolveGlobal(input: GlobalInput<T>, theme?: T): GlobalRules[]
  /**
   * Writes global styles into the `global` layer, as `resolveGlobal` resolves them, in the order of the
   * list (the cascade order), and returns the function that releases them: the rules of a set are written
   * once and removed when the last insertion of them is released (see `Cache.insertGlobal`).
   */
  insertGlobal(input: GlobalInput<T>, theme?: T): () => void
  /**
   * A sheet of named styles. Given a function of the theme it is a sheet that is resolved against a
   * theme (`resolve`, which `useStyle` calls). Given an object it is the entries themselves, usable at
   * once: no theme is read, so it works before there is one. Entries are made on first access and a
   * class's rule is written when the entry is first used, in the layer of how it is used.
   */
  createSheet<K extends string>(styles: ObjectSheet<K>): SheetEntries<K>
  createSheet<K extends string>(styles: (theme: T) => Record<K, WebStyleObject>): ThemedSheet<K, T>
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

/** Whether `value`, given to a styled component from outside, is a plain style object: not a sheet entry, not a class name. */
function isPlainStyle(value: ClassValue): boolean {
  return typeof value === 'object' && value !== null && !isSheetEntry(value)
}

/** The label of a styled component: `name-slot`, or '' without a name. */
function createLabel({ name, slot = 'root' }: StylerOptions): string {
  return name ? `${toKebabCase(name)}-${toKebabCase(slot)}` : ''
}

/** A short text for the token options of an engine, or '' when it has none of its own: they are part of what the server and the browser must agree on. */
function createTokenSignature(values: readonly unknown[]): string {
  const isDefault = values.every(
    (value) => value === undefined || (Array.isArray(value) && value.length === 0)
  )
  return isDefault ? '' : hashString(JSON.stringify(values))
}

/** Makes an engine that has no theme yet: it takes one from `setTheme`, or from the first `themeClass`. It needs no framework. */
export function createLazyEngine<T extends object = Theme>(options: EngineOptions = {}): Engine<T> {
  const { cache: given, suffix, hasLabels, hasLayers, hasPruning, hasColorFallbacks } = options
  const { hasScope, hasBaseClass, hasDevChecks, hasValueRepair } = options
  const { alwaysDeclare = [] } = options
  const { rawKeys, lengthKeys, modes, registered } = options
  if (given && options.prefix !== undefined && options.prefix !== given.prefix) {
    throw new TypeError(
      `the engine options give the prefix "${options.prefix}", which differs from the prefix "${given.prefix}" of the given cache; variables and classes would use two prefixes. Leave out \`prefix\`, or give the same one.`
    )
  }
  const prefix = given?.prefix ?? options.prefix ?? 'css'
  const cache =
    given ??
    createCache({
      prefix,
      suffix,
      hasLabels,
      hasLayers,
      hasPruning,
      hasColorFallbacks,
      hasValueRepair,
      hasScope,
      hasBaseClass,
      hasDevChecks,
      tokenSignature: createTokenSignature([rawKeys, lengthKeys, modes, registered, alwaysDeclare]),
    })
  const tokenOptions = { prefix, rawKeys, lengthKeys, modes, registered }
  let baseTheme: T | undefined
  let tokens: Tokens<T> | undefined
  // Counts the base themes, so that a sheet made from a function is made again for a new one.
  let version = 0

  const readTokens = (): Tokens<T> => {
    if (!tokens) throw new Error(NO_THEME_MESSAGE)
    return tokens
  }
  // Steps written as a function of the theme are resolved against the references when a rule is written.
  cache.setKeyframesTheme(() => readTokens().refs)

  const setTheme = (theme: T) => {
    if (theme === baseTheme) return
    baseTheme = theme
    tokens = createTokens(theme, tokenOptions)
    views = new WeakMap()
    recentViews = []
    // A registered variable gets its @property rule when a rule first uses it.
    cache.registerProperties(tokens.registrations)
    // Variables that code outside the engine reads are always declared.
    cache.markUsed(tokens.findNames(alwaysDeclare))
    version++
  }

  // A view keeps the base value as the fallback of a reference token, so a new base makes new views.
  let views = new WeakMap<object, T>()
  // The last views made that differ from each other, newest first, for a new theme object to reuse.
  let recentViews: T[] = []
  const createThemeView = (realTheme: T): T => {
    let view = views.get(realTheme)
    if (view === undefined) {
      const made = (tokens ?? createTokens(realTheme, tokenOptions)).createView(realTheme)
      view = recentViews.find((recent) => isSameView(recent, made))
      if (view === undefined) {
        view = made
        recentViews = [made, ...recentViews].slice(0, RECENT_VIEWS)
      }
      views.set(realTheme, view)
    }
    return view
  }

  // A theme object is read once per color scheme: a theme object is not changed after it is used.
  const themeClasses = new WeakMap<object, Map<string, string>>()
  const themeId = (partial: DeepPartial<T>, colorScheme?: ColorScheme) => {
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
  // The root rule of a theme object is worked out once per color scheme, like a theme class.
  const roots = new WeakMap<object, Map<string, [string, Record<string, string>]>>()
  const declareRoot = (theme: T, colorScheme?: ColorScheme) => {
    if (!tokens) setTheme(theme)
    const key = colorScheme ?? ''
    const known = roots.get(theme) ?? new Map<string, [string, Record<string, string>]>()
    roots.set(theme, known)
    let made = known.get(key)
    if (made === undefined) {
      const declarations = readTokens().declare(theme as DeepPartial<T>)
      made = [declareRootTheme(cache, declarations, { colorScheme }), declarations]
      known.set(key, made)
    }
    const [id, declarations] = made
    cache.insertRoot(id, declarations, colorScheme)
    return id
  }
  const findThemeIds = (partial: DeepPartial<T>) => [...(themeClasses.get(partial)?.values() ?? [])]
  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    createThemeClassName(cache.prefix, themeId(partial, colorScheme), colorScheme)
  const when = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    createThemeKey(themeId(partial, colorScheme))

  const scopeName = `${cache.prefix}-scope`
  const scopeClass = () => {
    cache.insertOnce(scopeName, [`.${scopeName}{display:contents;}`], 'theme')
    return scopeName
  }

  /** The entries of `source`, each made on first access; nothing is written until an entry is used. */
  const createEntries = <K extends string>(source: Record<K, WebStyleObject>): SheetEntries<K> =>
    createLazyRecord(Object.keys(source) as K[], (key) => cache.createEntry(source[key]))

  const createThemedSheet = <K extends string>(
    styles: (theme: T) => Record<K, WebStyleObject>
  ): ThemedSheet<K, T> => {
    // The entries against the base theme are made again for a new base; those against a view are made once.
    let baseEntries: SheetEntries<K> | undefined
    let madeAt = 0
    const viewEntries = new WeakMap<object, SheetEntries<K>>()
    return {
      resolve(theme?: T) {
        if (theme !== undefined) {
          let entries = viewEntries.get(theme)
          if (entries === undefined) {
            entries = createEntries(styles(theme))
            viewEntries.set(theme, entries)
          }
          return entries
        }
        if (baseEntries === undefined || madeAt !== version) {
          baseEntries = createEntries(styles(readTokens().refs))
          madeAt = version
        }
        return baseEntries
      },
    }
  }

  function createSheet<K extends string>(styles: ObjectSheet<K>): SheetEntries<K>
  function createSheet<K extends string>(
    styles: (theme: T) => Record<K, WebStyleObject>
  ): ThemedSheet<K, T>
  function createSheet<K extends string>(
    styles: ObjectSheet<K> | ((theme: T) => Record<K, WebStyleObject>)
  ) {
    return typeof styles === 'function' ? createThemedSheet(styles) : createEntries(styles)
  }

  const createStyler = (
    stylerOptions: StylerOptions,
    styles: readonly StyleInput[],
    inherited: readonly StyleInput[] = []
  ): Styler => {
    const label = createLabel(stylerOptions)
    const list = [...inherited, ...(label ? [{ label }] : []), ...styles]
    const hasFunction = list.some(isStyleFunction)
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
    const resolveAll = (
      source: readonly StyleInput[],
      props: Record<string, unknown>,
      theme: unknown
    ): StyleResult[] => source.map((style) => resolveStyle(style, props, theme))

    /** The base class (written first) and the styles that make the props class, which is made for each render. */
    interface Plan {
      baseClass: string
      propsStyles: readonly StyleInput[]
    }

    // Without `hasBaseClass`, or without any function, the split does not depend on the theme: the whole
    // list is the base when it has no function, and the props part when it has one.
    let fixed: Plan | undefined
    const getFixed = (): Plan =>
      (fixed ??= hasFunction
        ? { baseClass: '', propsStyles: list }
        : { baseClass: cache.css(...(list as WebStyleObject[])), propsStyles: [] })

    // With functions, where the props part starts depends on the theme view, because a function that
    // reads only the theme is part of the base, and what it reads from the theme may differ per view.
    // A view is worked out once, with the props of the first call: a function that read no prop then
    // takes the same path for every later call with that view.
    const plans = new WeakMap<object, Plan>()
    const makePlan = (props: Record<string, unknown>, view: object): Plan => {
      const { base, propsFrom } = splitLeading(list, props, view)
      const hasProps = propsFrom < list.length
      const lead = label ? [{ label }] : []
      return {
        baseClass: base.some(Boolean) ? cache.css(...(base as WebStyleObject[])) : '',
        propsStyles: hasProps ? [...lead, ...list.slice(propsFrom)] : [],
      }
    }
    const getPlan = (props: Record<string, unknown>, theme: unknown): Plan => {
      if (!cache.hasBaseClass || !hasFunction) return getFixed()
      const view = (theme ?? readTokens().refs) as object
      let plan = plans.get(view)
      if (plan === undefined) {
        plan = makePlan(props, view)
        plans.set(view, plan)
      }
      return plan
    }

    /** The classes of the styles: the base, then the props class that is made after it. */
    const getOwn = (plan: Plan, props: Record<string, unknown>, theme: unknown) => {
      if (plan.propsStyles.length === 0) return plan.baseClass
      const resolved = resolveAll(plan.propsStyles, props, theme)
      const second = cache.cssWith({ after: plan.baseClass }, ...resolved)
      return [plan.baseClass, second].filter(Boolean).join(' ')
    }

    /** Without layers there is no override class and no order between classes to rely on: what comes in is merged with all of the styles, into the one class. */
    const getMerged = (
      props: Record<string, unknown>,
      theme: unknown,
      extras: readonly ClassValue[]
    ) => cache.css(...resolveAll(list, props, theme), ...extras)

    const getClassName: Styler['getClassName'] = (props, extra, theme) => {
      const extras = Array.isArray(extra) ? extra : [extra]
      const hasExtras = extras.some(Boolean)
      if (hasExtras && !cache.hasLayers) return getMerged(props, theme, extras)
      const own = getOwn(getPlan(props, theme), props, theme)
      if (!hasExtras) return own
      // The override class takes the label of the component, so that it can be told from the others;
      // one sheet entry given alone is used as it is.
      const overrides = cache.cssWith({ layer: 'overrides', label: label || undefined }, ...extras)
      return [own, overrides].filter(Boolean).join(' ')
    }

    return {
      styles: list,
      isDynamic: hasFunction,
      getClassName,
      getHeldClass(props, extra, theme) {
        const extras: readonly ClassValue[] = Array.isArray(extra) ? extra : [extra]
        if (!extras.some(isPlainStyle)) {
          return { className: getClassName(props, extras, theme), hold: undefined }
        }
        if (!cache.hasLayers) return cache.cssHeld({}, ...resolveAll(list, props, theme), ...extras)
        const own = getOwn(getPlan(props, theme), props, theme)
        const overrides = cache.cssHeld(
          { layer: 'overrides', label: label || undefined },
          ...extras
        )
        return {
          className: [own, overrides.className].filter(Boolean).join(' '),
          hold: overrides.hold,
        }
      },
    }
  }

  const resolveGlobal = (input: GlobalInput<T>, theme?: T): GlobalRules[] => {
    const readTheme = () => theme ?? readTokens().refs
    const items = Array.isArray(input) ? input : [input]
    return items.map((item) => cache.compileGlobal(readGlobalStyles<T>(item, readTheme)))
  }

  const insertGlobal = (input: GlobalInput<T>, theme?: T): (() => void) => {
    const releases = resolveGlobal(input, theme).map(cache.insertGlobal)
    return () => {
      for (const release of releases) release()
    }
  }

  return {
    cache,
    css: cache.css,
    resolveGlobal,
    insertGlobal,
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
    keyframes,
    insertKeyframes: cache.insertKeyframes,
    setTheme,
    createThemeView,
    themeClass,
    themeId,
    findThemeIds,
    declareRoot,
    when,
    whenScheme: createSchemeKey,
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
