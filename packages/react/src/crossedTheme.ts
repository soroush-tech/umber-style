import { createTokens, isDevelopment, type DeepPartial, type TokenOptions } from '@umber-style/core'
import { mergeTheme } from '@umber-style/core/internal'

/** What the merge of a theme that crossed from a provider of the server build reads besides the two themes. */
export interface Crossing {
  /** The prefix of the engine, at the start of a warning. */
  readonly prefix: string
  /** The token options of the engine of the client build, which say which values are raw; none before a style of the prefix is loaded. */
  readonly tokens: Readonly<TokenOptions> | undefined
  /** Whether the theme below is the base theme of the client build, which the warning names; else it is the theme of a provider above. */
  readonly isBase: boolean
}

/** A raw value of a crossed theme that the theme below has another value for: its dotted path and both values. */
interface Difference {
  readonly path: string
  readonly crossed: unknown
  readonly below: unknown
}

/** Whether `value` is an object or an array, whose members a walk reads. */
function isContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Whether `value` is an array, or an object made by a literal or with no prototype. */
function isCopied(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return Array.isArray(value) || prototype === Object.prototype || prototype === null
}

/** The member `key` of `value`, or undefined where `value` is no object. */
function readMember(value: unknown, key: string): unknown {
  return isContainer(value) ? value[key] : undefined
}

/**
 * Whether `value`, or an object inside it, has an own member that is not an enumerable string key: a
 * helper put on with `Object.defineProperty`, a symbol (the `length` of an array is not one).
 * `ancestors` holds the objects it is inside of, so a cycle ends the walk.
 */
function hasHidden(value: unknown, ancestors: Set<object>): boolean {
  if (!isContainer(value) || ancestors.has(value)) return false
  ancestors.add(value)
  const visible = Object.keys(value).length + (Array.isArray(value) ? 1 : 0)
  const isHidden =
    Reflect.ownKeys(value).length > visible ||
    Object.values(value).some((member) => hasHidden(member, ancestors))
  ancestors.delete(value)
  return isHidden
}

// The top-level keys of each theme below whose member has hidden members, found once for each theme.
const hiddenKeys = new WeakMap<object, readonly string[]>()

/** The top-level keys of `theme` whose member has a hidden member at any depth. */
function findHiddenKeys(theme: Record<string, unknown>): readonly string[] {
  let found = hiddenKeys.get(theme)
  if (found === undefined) {
    found = Object.keys(theme).filter((key) => hasHidden(theme[key], new Set([theme])))
    hiddenKeys.set(theme, found)
  }
  return found
}

/** Adds to `found` each value of `crossed` that differs from `below` at its path, deeply; a value left undefined keeps the one below. */
function compareRaw(crossed: unknown, below: unknown, path: string, found: Difference[]): void {
  if (isContainer(crossed)) {
    for (const key of Object.keys(crossed)) {
      compareRaw(crossed[key], readMember(below, key), `${path}.${key}`, found)
    }
  } else if (crossed !== undefined && crossed !== below) {
    found.push({ path, crossed, below })
  }
}

/**
 * Adds to `found` each raw value of `crossed` that differs from `below`. A raw value is one that `view`,
 * the view of `crossed` made with the token options, holds as it is: a token is a `var()` reference there.
 */
function collectDifferences(
  view: unknown,
  crossed: unknown,
  below: unknown,
  path: string,
  found: Difference[]
): void {
  if (view === crossed) {
    compareRaw(crossed, below, path, found)
  } else if (isContainer(view) && isContainer(crossed)) {
    for (const key of Object.keys(crossed)) {
      collectDifferences(view[key], crossed[key], readMember(below, key), `${path}.${key}`, found)
    }
  }
}

/**
 * `value` with its enumerable members only, deeply: each array and plain object copied without what is
 * hidden; any other value, and an object met again inside itself, as it is.
 */
function toVisible(value: unknown, ancestors: Set<object>): unknown {
  if (!isContainer(value) || !isCopied(value) || ancestors.has(value)) return value
  ancestors.add(value)
  const copy = Array.isArray(value)
    ? value.map((item: unknown) => toVisible(item, ancestors))
    : Object.fromEntries(
        Object.entries(value).map(([key, member]) => [key, toVisible(member, ancestors)])
      )
  ancestors.delete(value)
  return copy
}

// For each theme below, its copies whose members under some top-level keys are visible only, by those keys.
const strippedThemes = new WeakMap<object, Map<string, object>>()

/** `theme` with the members under `keys` copied with their enumerable members only, the rest as it is; one object for each theme and keys. */
function readStripped(theme: Record<string, unknown>, keys: readonly string[]): object {
  const byKeys = strippedThemes.get(theme) ?? new Map<string, object>()
  strippedThemes.set(theme, byKeys)
  const id = keys.join('\n')
  let stripped = byKeys.get(id)
  if (stripped === undefined) {
    const descriptors = Object.getOwnPropertyDescriptors(theme)
    for (const key of keys) {
      const value = toVisible(theme[key], new Set([theme]))
      descriptors[key] = { value, enumerable: true, writable: true, configurable: true }
    }
    stripped = Object.create(Object.getPrototypeOf(theme), descriptors) as object
    byKeys.set(id, stripped)
  }
  return stripped
}

/** A value as the warning shows it: a string quoted, anything else as it is written. */
function showValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

// The prefix and path of each difference warned about: once each.
const warned = new Set<string>()

/** Warns once for each path of `differences`, in development. */
function warnDifferences(differences: readonly Difference[], crossing: Crossing): void {
  const { prefix, isBase } = crossing
  const below = isBase ? 'the base theme of the client build' : 'the theme of the provider above it'
  const fix = isBase
    ? 'the client build does not have this theme. Register the same theme in a module the client loads, with getEngine().setTheme(theme), createStyle(theme) or configure({ theme }).'
    : 'the helpers of that theme are made from other values, and they are left out. Give this theme to a ThemeProvider in a client file to read its own helpers in client components.'
  for (const { path, crossed, below: value } of differences) {
    const key = `${prefix} ${path}`
    if (warned.has(key)) continue
    warned.add(key)
    console.warn(
      `[${prefix}] The theme of a server ThemeProvider has ${path} = ${showValue(crossed)}, but ${below} has ${showValue(value)}: ${fix}`
    )
  }
}

/** `crossed` merged over `below`, as `mergeCrossed` decides, made once for each pair. */
function mergeOverHidden<T>(
  below: Record<string, unknown>,
  crossed: Record<string, unknown>,
  keys: readonly string[],
  crossing: Crossing
): T {
  const shared = keys.filter((key) => crossed[key] !== undefined)
  const picked = Object.fromEntries(shared.map((key) => [key, crossed[key]]))
  const { prefix, rawKeys, lengthKeys, modes } = crossing.tokens ?? {}
  const view = createTokens(picked, { prefix, rawKeys, lengthKeys, modes }).refs
  const differences: Difference[] = []
  for (const key of shared)
    collectDifferences(view[key], crossed[key], below[key], key, differences)
  if (differences.length === 0) return mergeTheme(below as T, crossed as DeepPartial<T>)
  if (isDevelopment()) warnDifferences(differences, crossing)
  const changed = [...new Set(differences.map(({ path }) => path.split('.')[0]))]
  return mergeTheme(readStripped(below, changed) as T, crossed as DeepPartial<T>)
}

// The merge of each pair of a theme below and a crossed theme over it, where the one below has hidden members.
const crossedMerges = new WeakMap<object, WeakMap<object, unknown>>()

/**
 * `crossed`, a theme that crossed from a provider of the server build as plain data, merged over `below`
 * (the base theme of the client build, or the theme of a provider above) as `mergeTheme` merges, which
 * keeps the hidden members of `below` (a helper on `breakpoints` made with `Object.defineProperty`). Where
 * a raw value of `crossed` (one that is not a variable: its view holds it as it is) differs from `below`
 * under a top-level key whose member has hidden members, that member of `below` is taken with its
 * enumerable members only, so no helper made from other values is read, and in development each such
 * path is warned about once. A `below` with no hidden member is merged as `mergeTheme` merges, with no
 * comparison. The same pair gives the same theme every time.
 */
export function mergeCrossed<T>(
  below: T | undefined,
  crossed: DeepPartial<T>,
  crossing: Crossing
): T {
  if (!isContainer(below) || !isContainer(crossed)) return mergeTheme(below, crossed)
  const keys = findHiddenKeys(below)
  if (keys.length === 0) return mergeTheme<T>(below, crossed)
  const byCrossed = crossedMerges.get(below) ?? new WeakMap<object, unknown>()
  crossedMerges.set(below, byCrossed)
  if (!byCrossed.has(crossed))
    byCrossed.set(crossed, mergeOverHidden(below, crossed, keys, crossing))
  return byCrossed.get(crossed) as T
}
