import {
  createCache,
  createDomSheet,
  createMemorySheet,
  keyframes as registerKeyframes,
  type Cache,
  type CacheOptions,
  type ClassValue,
  type GlobalStyleObject,
  type KeyframesSteps,
  type Sheet,
  type StyleObject,
  type UmberCache,
  type UmberSheet,
  type WebStyleObject,
} from '@umber-style/core'
import { parseKeyframesTemplate, parseStyleTemplate } from '@umber-style/core/internal'

/** What `css` takes: style objects, class names, CSS text (a string with `:` or `{`), nothing (`false`, `null`, `undefined`, `''`, `true`), and lists of them, nested. */
export type CssInput = WebStyleObject | string | boolean | null | undefined | readonly CssInput[]

/** What `cx` takes: class names, objects whose keys are class names that are used when their value is truthy, nothing, and lists of them, nested. */
export type ClassNamesInput =
  | string
  | boolean
  | null
  | undefined
  | Readonly<Record<string, unknown>>
  | readonly ClassNamesInput[]

/** What `injectGlobal` takes: global style objects (selectors and at-rules as keys), nothing, and lists of them, nested. */
export type InjectGlobalInput =
  | GlobalStyleObject
  | boolean
  | null
  | undefined
  | readonly InjectGlobalInput[]

/** `css`: one class name for its arguments, or for a tagged template. */
export interface CssFunction {
  (template: TemplateStringsArray, ...values: unknown[]): string
  (...args: CssInput[]): string
}

/** `keyframes`: the name of an animation, from its steps or from a tagged template. */
export interface KeyframesFunction {
  (template: TemplateStringsArray, ...values: unknown[]): string
  (steps: KeyframesSteps): string
}

/** `injectGlobal`: writes global rules, from style objects or from a tagged template. */
export interface InjectGlobalFunction {
  (template: TemplateStringsArray, ...values: unknown[]): void
  (...styles: InjectGlobalInput[]): void
}

/**
 * A cache made by other code, that an instance shares: it may carry the sheet it writes to, or, as a cache
 * of `@umber-style/cache` does, the style elements that hold its rules (`UmberSheet`).
 */
export type SharedCache = Cache & { readonly sheet?: Sheet | UmberSheet }

/** The options of `createInstance`: those of the core's `createCache`, with `key` for `prefix`, or a cache to share. */
export interface InstanceOptions extends Omit<CacheOptions, 'prefix'> {
  /** The first part of every class name, and the key of the style element (`data-style="<key>"`). Default `css`. */
  key?: string
  /**
   * Whether every rule goes into a cascade layer. Default `false` here (the core's default is `true`):
   * a class of this package is then an ordinary class next to the app's own CSS, which is not layered.
   */
  hasLayers?: boolean
  /**
   * A cache to use instead of making one, so that the classes of this instance and those of other code
   * live in one cache. Its options are its own: the other cache options are not read, and a `key` that
   * differs from its prefix throws. The sheet of the instance is `sheet`, or the cache's own `sheet`
   * member: for a cache of `@umber-style/cache`, its style elements.
   */
  cache?: SharedCache
}

/** The functions of one instance, bound to its cache; `S` is the type of its sheet. */
export interface CssInstance<S extends Sheet | UmberSheet = Sheet> {
  /**
   * One class for style objects and class names this cache made (resolved back to their styles), merged
   * left to right so the last wins; a string that holds `:` or `{` is CSS text, read as a template is and
   * merged at its place; other class names pass through, in front of it. Lists are
   * flattened; `false`, `null`, `undefined`, `''` and `true` are nothing. As a tag, the template is
   * read as CSS text. Returns the class string, '' when there is nothing.
   */
  css: CssFunction
  /**
   * The class string of its arguments: when two or more of the classes were made by this cache, they
   * are merged into one new class, the last winning, after the other class names; else the classes as
   * they are.
   */
  cx(...classNames: ClassNamesInput[]): string
  /** Registers the animation, writes its `@keyframes` rule at once, and returns its name. */
  keyframes: KeyframesFunction
  /** Writes global rules at once; they stay. Rules of the same text are written once. */
  injectGlobal: InjectGlobalFunction
  /** The cache. After `flush`, it reads the new one. */
  readonly cache: Cache
  /** The sheet the cache writes to; for an instance given a cache of `@umber-style/cache` and no `sheet`, the style elements of that cache. */
  readonly sheet: S
  /**
   * Removes every rule from the sheet and starts a new, empty cache over it: the classes, the global
   * rules and the hydrated ids are forgotten, and a style is written again when it is next used. Throws
   * a `TypeError` for an instance that was given its cache, which other code shares.
   */
  flush(): void
  /** Marks rules as present on the page (the ids of the core's `extract()`), so that they are not written again. */
  hydrate(ids: readonly string[]): void
  /**
   * Pushes the style object of each class of `classNames` that this cache made onto `registeredStyles`,
   * in order, and returns the other class names, each followed by a space.
   */
  getRegisteredStyles(registeredStyles: StyleObject[], classNames: string): string
  /**
   * `className` with the classes this cache made merged into one new class, the last winning, after the
   * other class names, when there are two or more of them; else `className` as it is.
   */
  merge(className: string): string
}

/** What makes a string given to `css` CSS text rather than class names: a class name holds neither. */
const CSS_TEXT = /[:{]/

/** Whether `value` is the strings of a tagged template. */
function isTemplate(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Object.hasOwn(value, 'raw')
}

/** The sheet of a cache made here: the style elements of the document, written as `speedy` says and carrying `nonce`, or one in memory where there is no document. */
function createDefaultSheet(
  prefix: string,
  { speedy, nonce }: Pick<CacheOptions, 'speedy' | 'nonce'>
): Sheet {
  return typeof document === 'undefined'
    ? createMemorySheet()
    : createDomSheet(prefix, undefined, { speedy, nonce })
}

/** The items of `args`, lists flattened, without `false`, `null`, `undefined`, `''` and `true`. */
function flatten<T>(args: readonly unknown[], out: T[] = []): T[] {
  for (const arg of args) {
    if (Array.isArray(arg)) flatten(arg, out)
    else if (arg && arg !== true) out.push(arg as T)
  }
  return out
}

/** The class names of `cx` arguments, in order. */
function collectClassNames(args: readonly ClassNamesInput[], out: string[] = []): string[] {
  for (const arg of flatten<string | Readonly<Record<string, unknown>>>(args)) {
    if (typeof arg === 'string') out.push(arg)
    else for (const [name, isOn] of Object.entries(arg)) if (isOn) out.push(name)
  }
  return out
}

/** What a template gave, or a `TypeError` when it gave a function: an interpolation needs props or a theme, and there are none here. */
function readTemplate<R>(name: string, result: R | ((input: never) => unknown)): R {
  if (typeof result === 'function') {
    throw new TypeError(
      `${name}(): an interpolation of this template is a function, which needs props or a theme, and ${name}() has none. Call it yourself and interpolate what it returns.`
    )
  }
  return result as R
}

/** Makes an instance over a cache of `@umber-style/cache`: its sheet is the style elements of that cache. */
export default function createInstance(
  options: InstanceOptions & { cache: UmberCache; sheet?: undefined }
): CssInstance<UmberSheet>
/** Makes an instance: a cache of its own (or the one given) and the functions bound to it. */
export default function createInstance(options?: InstanceOptions): CssInstance
export default function createInstance(
  options: InstanceOptions = {}
): CssInstance<Sheet | UmberSheet> {
  const { key, cache: given, sheet: givenSheet, hasLayers = false, ...cacheOptions } = options
  if (given && key !== undefined && key !== given.prefix) {
    throw new TypeError(
      `createInstance(): the key "${key}" differs from the prefix "${given.prefix}" of the given cache. Leave out \`key\`, or give the same one.`
    )
  }
  const prefix = key ?? 'css'
  const sheet = givenSheet ?? (given ? given.sheet : createDefaultSheet(prefix, cacheOptions))
  if (!sheet) {
    throw new TypeError(
      'createInstance(): the given cache has no `sheet` member: give the sheet it writes to as `sheet` too.'
    )
  }
  // Only an instance that was not given its cache makes one, and its sheet is then a sheet of the core.
  const makeCache = (): Cache =>
    createCache({ ...cacheOptions, prefix, hasLayers, sheet: sheet as Sheet })
  let current = given ?? makeCache()
  // The ids that `hydrate` marked: the global rules among them are not written by `injectGlobal`.
  const hydrated = new Set<string>()

  /** A class name this cache made, as its style, so that a template merges it; anything else as it is. */
  const resolveClass = (value: unknown): unknown =>
    (typeof value === 'string' && current.registered.get(value)) || value

  /** A string that is not a class of this cache and holds `:` or `{`, as the style of its CSS text; anything else as it is. */
  const readText = (value: ClassValue): ClassValue =>
    typeof value === 'string' && CSS_TEXT.test(value) && !current.registered.has(value)
      ? (parseStyleTemplate([value], []) as WebStyleObject)
      : value

  const css = ((...args: unknown[]): string => {
    const [first, ...values] = args
    // The common call, one style object: straight to the cache.
    if (args.length === 1 && typeof first === 'object' && first !== null && !Array.isArray(first)) {
      return current.css(first as WebStyleObject)
    }
    if (isTemplate(first)) {
      return current.css(
        readTemplate('css', parseStyleTemplate(first, values.map(resolveClass))) as WebStyleObject
      )
    }
    return current.css(...flatten<ClassValue>(args).map(readText))
  }) as CssFunction

  const merge = (className: string): string => {
    const names = className.split(/\s+/)
    return names.filter((name) => current.registered.has(name)).length < 2
      ? className
      : current.css(className)
  }

  const keyframes = ((first: TemplateStringsArray | KeyframesSteps, ...values: unknown[]) => {
    const steps = isTemplate(first)
      ? readTemplate('keyframes', parseKeyframesTemplate(first, values))
      : first
    const name = registerKeyframes(steps)
    current.insertKeyframes(name)
    return name
  }) as KeyframesFunction

  const injectGlobal = ((...args: unknown[]): void => {
    const [first, ...values] = args
    const styles = isTemplate(first)
      ? [readTemplate('injectGlobal', parseStyleTemplate(first, values))]
      : flatten<GlobalStyleObject>(args)
    for (const style of styles) {
      const rules = current.compileGlobal(style as GlobalStyleObject)
      if (!hydrated.has(rules.id)) current.insertGlobal(rules)
    }
  }) as InjectGlobalFunction

  return {
    css,
    cx: (...classNames) => merge(collectClassNames(classNames).join(' ')),
    keyframes,
    injectGlobal,
    // A cache of its own is read through this, so that it is the new one after `flush`.
    cache:
      given ?? new Proxy({} as Cache, { get: (_target, member) => Reflect.get(current, member) }),
    sheet,
    flush: () => {
      if (given) {
        throw new TypeError(
          'flush(): this instance was given its cache, which other code shares, so it cannot empty it.'
        )
      }
      const own = sheet as Sheet
      for (let index = own.rules.length - 1; index >= 0; index--) own.remove?.(index)
      hydrated.clear()
      current = makeCache()
    },
    hydrate: (ids) => {
      for (const id of ids) {
        hydrated.add(id)
        current.insertOnce(id, [])
      }
    },
    getRegisteredStyles: (registeredStyles, classNames) => {
      let raw = ''
      for (const name of classNames.split(/\s+/)) {
        const style = current.registered.get(name)
        if (style) registeredStyles.push(style)
        else if (name) raw += `${name} `
      }
      return raw
    },
    merge,
  }
}

// Also by name: a CommonJS build of a library that imports this entry by default gets the whole
// `module.exports` from its interop, not the function; one that imports it by name gets the function.
export { createInstance }
