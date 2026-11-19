/** How a token is written: a variable, the real value in the rules, a variable with a fallback, or a real value that is never written. */
export type TokenMode = 'variable' | 'inline' | 'reference' | 'raw'

export interface TokenOptions {
  /** Put before every variable name, e.g. 'ds' gives --ds-palette-primary. */
  prefix?: string
  /** Top-level theme keys that stay real values and get no variable: the same as mode `raw`. Default ['breakpoints', 'components']. */
  rawKeys?: readonly string[]
  /** Top-level theme keys whose numbers are lengths, declared with px. Default ['space', 'sizes', 'radii', 'fontSizes', 'borderWidths']. */
  lengthKeys?: readonly string[]
  /**
   * The mode of a token, by dotted theme path ('zIndex', 'transitions.duration', 'palette.primary').
   * The most specific path wins, and an entry beats `rawKeys`. Default mode: `variable`.
   */
  modes?: Readonly<Record<string, TokenMode>>
}

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export interface Tokens<T> {
  /** The theme's shape, with var(--name) in place of each variable token, var(--name, value) for a reference, and the real value for the rest. */
  refs: T
  /** The variable declarations of `theme`, which may be a partial theme: only the variable and reference tokens it has. */
  declare(theme: DeepPartial<T>): Record<string, string>
  /** The shape of `realTheme` like `refs`: the same references (a fallback is the base value), the real values of `realTheme` for the rest. */
  createView(realTheme: T): T
  /** The names of the variables of the base theme under these dotted paths (a top-level key or a deeper path). */
  findNames(paths: readonly string[]): string[]
}

const DEFAULT_RAW_KEYS = ['breakpoints', 'components']
const DEFAULT_LENGTH_KEYS = ['space', 'sizes', 'radii', 'fontSizes', 'borderWidths']

/** Whether `value` is an object made by a literal, not a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Whether `value` is a string or a number, the values that get a variable. */
function isLeaf(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** A theme key as one part of a variable name. */
function toSegment(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
}

/** A token that is declared: its variable name, its dotted theme path and its value. */
interface Declared {
  name: string
  path: string
  value: string
}

/** The dotted paths above each key of `modes`: 'a.b.c' gives 'a' and 'a.b'. */
function collectParents(modes: ReadonlyMap<string, TokenMode>): Set<string> {
  const parents = new Set<string>()
  for (const key of modes.keys()) {
    let index = key.indexOf('.')
    while (index !== -1) {
      parents.add(key.slice(0, index))
      index = key.indexOf('.', index + 1)
    }
  }
  return parents
}

/** Turns a theme into variable references and the declarations that give them values. */
export function createTokens<T extends object>(theme: T, options: TokenOptions = {}): Tokens<T> {
  const { prefix = '', rawKeys = DEFAULT_RAW_KEYS, lengthKeys = DEFAULT_LENGTH_KEYS } = options
  const modes = new Map(Object.entries(options.modes ?? {}))
  const parents = collectParents(modes)

  const toName = (path: readonly string[]) =>
    `--${[prefix, ...path.map(toSegment)].filter(Boolean).join('-')}`

  /** The mode of the token at `path`: the longest path in `modes`, else `rawKeys`, else variable. */
  const readMode = (path: readonly string[]): TokenMode => {
    for (let length = path.length; length > 0; length--) {
      const mode = modes.get(path.slice(0, length).join('.'))
      if (mode !== undefined) return mode
    }
    return rawKeys.includes(path[0]) ? 'raw' : 'variable'
  }

  /** Whether everything under `path` keeps its real value: one mode that writes no variable, and no entry deeper down. */
  const isKept = (path: readonly string[]): boolean => {
    const mode = readMode(path)
    return (mode === 'raw' || mode === 'inline') && !parents.has(path.join('.'))
  }

  /** The value a variable at `path` holds: a number under a length key is in px. */
  const toDeclared = (path: readonly string[], value: string | number): string => {
    const isLength = typeof value === 'number' && value !== 0 && lengthKeys.includes(path[0])
    return isLength ? `${value}px` : String(value)
  }

  const collect = (node: unknown, path: string[], found: Declared[]): void => {
    if (path.length > 0 && isKept(path)) return
    if (Array.isArray(node)) {
      node.forEach((item, index) => collect(item, [...path, String(index)], found))
    } else if (isPlainObject(node)) {
      for (const [key, value] of Object.entries(node)) collect(value, [...path, key], found)
    } else if (isLeaf(node)) {
      const mode = readMode(path)
      if (mode === 'variable' || mode === 'reference') {
        found.push({ name: toName(path), path: path.join('.'), value: toDeclared(path, node) })
      }
    }
  }

  const list = (partial: unknown): Declared[] => {
    const found: Declared[] = []
    collect(partial, [], found)
    return found
  }

  const declare = (partial: unknown): Record<string, string> =>
    Object.fromEntries(list(partial).map(({ name, value }) => [name, value]))

  // The fallback of a reference is the value in the base theme.
  const baseTokens = list(theme)
  const baseDeclarations = Object.fromEntries(baseTokens.map(({ name, value }) => [name, value]))

  const toRef = (path: readonly string[], node: string | number): string | number => {
    const mode = readMode(path)
    const name = toName(path)
    if (mode === 'variable') return `var(${name})`
    if (mode !== 'reference') return node
    const fallback = baseDeclarations[name]
    return fallback === undefined ? `var(${name})` : `var(${name}, ${fallback})`
  }

  const toRefs = (node: unknown, path: string[]): unknown => {
    if (path.length > 0 && isKept(path)) return node
    if (Array.isArray(node)) {
      return node.map((item, index) => toRefs(item, [...path, String(index)]))
    }
    if (isPlainObject(node)) {
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [key, toRefs(value, [...path, key])])
      )
    }
    return isLeaf(node) ? toRef(path, node) : node
  }

  return {
    refs: toRefs(theme, []) as T,
    declare,
    createView: (realTheme) => toRefs(realTheme, []) as T,
    findNames: (wanted) =>
      baseTokens
        .filter(({ path }) => wanted.some((one) => path === one || path.startsWith(`${one}.`)))
        .map(({ name }) => name),
  }
}
