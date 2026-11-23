import { createPropertyRule, type RegisteredSyntax } from './registered'

/** How a token is written: a variable, the real value in the rules, a variable with a fallback, or a real value that is never written. */
export type TokenMode = 'variable' | 'inline' | 'reference' | 'raw'

/** The options of `createTokens`: how the variables of a theme are named, and which values are tokens. */
export interface TokenOptions {
  /** Put before every variable name, e.g. 'ds' gives --ds-palette-primary. */
  prefix?: string
  /** Top-level theme keys that stay real values and get no variable: the same as mode `raw`. Default ['breakpoints', 'components']. */
  rawKeys?: readonly string[]
  /** Top-level theme keys whose numbers are lengths, declared with px. Default ['space', 'sizes', 'radii', 'fontSizes', 'borderWidths']. */
  lengthKeys?: readonly string[]
  /**
   * The mode of a token, by dotted theme path ('zIndex', 'transitions.duration', 'palette.primary'), or
   * by a pattern in which `*` stands for any one key ('typography.*.fontSize'). The longest path wins, an
   * exact path before a pattern of the same length and a pattern with fewer `*` before one with more,
   * and an entry beats `rawKeys`. Default mode: `variable`.
   */
  modes?: Readonly<Record<string, TokenMode>>
  /**
   * The tokens that are registered custom properties (an `@property` rule), by dotted theme path, found
   * like `modes` (the most specific path wins; a top-level key registers everything under it). `true`
   * infers the syntax from the base theme value, otherwise it is one of the syntaxes. A registered
   * variable has a type, so a `transition` on it animates a theme switch. Only variable and reference
   * tokens have a variable to register.
   */
  registered?: Readonly<Record<string, RegisteredSyntax | true>>
}

/** `T` with every key optional, at every depth; a function is kept as it is. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** What `createTokens` makes of a theme: its references, its declarations, and the views of other themes of its shape. */
export interface Tokens<T> {
  /** The theme's shape, with var(--name) in place of each variable token, var(--name, value) for a reference, and the real value for the rest. */
  refs: T
  /** The variable declarations of `theme`, which may be a partial theme: only the variable and reference tokens it has. */
  declare(theme: DeepPartial<T>): Record<string, string>
  /** The shape of `realTheme` like `refs`: the same references (a fallback is the base value), the real values of `realTheme` for the rest. */
  createView(realTheme: T): T
  /** The names of the variables of the base theme under these dotted paths (a top-level key or a deeper path). */
  findNames(paths: readonly string[]): string[]
  /** The `@property` rule of each registered variable of the base theme, by variable name. */
  registrations: Readonly<Record<string, string>>
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

/** Whether every character of `key` is a lowercase letter, a digit, `_` or `-`: a part of a name as it is. */
function isSegment(key: string): boolean {
  for (let index = 0; index < key.length; index++) {
    const code = key.codePointAt(index) as number
    const isKept =
      (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95 || code === 45
    if (!isKept) return false
  }
  return true
}

/** A theme key as one part of a variable name. */
function toSegment(key: string): string {
  // Such a key has nothing to rewrite: no capital to split before, nothing to lower or to replace.
  if (isSegment(key)) return key
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
  /** The value in the theme: a number stays a number. */
  source: string | number
  /** Whether the value is a number of a length key, which `value` writes in px. */
  isLength: boolean
}

/** The value of the longest dotted path in `entries` that `path` starts with, or undefined. */
function findByPath<V>(entries: ReadonlyMap<string, V>, path: readonly string[]): V | undefined {
  // No entry has any path: there is nothing to join and look up.
  if (entries.size === 0) return undefined
  for (let length = path.length; length > 0; length--) {
    const value = entries.get(path.slice(0, length).join('.'))
    if (value !== undefined) return value
  }
  return undefined
}

/** Whether the dotted path `pattern`, split, with `*` for any one key, is `path`. */
function matchesPattern(pattern: readonly string[], path: readonly string[]): boolean {
  return (
    pattern.length === path.length &&
    pattern.every((part, index) => part === '*' || part === path[index])
  )
}

/** The `modes` entries with a `*` in their path, the fewest `*` first: the more specific pattern wins. */
function collectPatterns(modes: ReadonlyMap<string, TokenMode>): [string[], TokenMode][] {
  return [...modes]
    .map(([key, mode]): [string[], TokenMode] => [key.split('.'), mode])
    .filter(([parts]) => parts.includes('*'))
    .sort(
      ([first], [second]) =>
        first.filter((part) => part === '*').length - second.filter((part) => part === '*').length
    )
}

/** The mode of the longest path that `path` starts with: at each length the entry of that exact path, else the first pattern that matches it. */
function findMode(
  modes: ReadonlyMap<string, TokenMode>,
  patterns: readonly [string[], TokenMode][],
  path: readonly string[]
): TokenMode | undefined {
  for (let length = path.length; length > 0; length--) {
    const start = path.slice(0, length)
    const mode =
      modes.get(start.join('.')) ?? patterns.find(([parts]) => matchesPattern(parts, start))?.[1]
    if (mode !== undefined) return mode
  }
  return undefined
}

/** The dotted paths above each key of `modes`: 'a.b.c' gives 'a' and 'a.b' (with a `*` as it is written). */
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

/** Whether `node` has the dotted `path` (a key, a deeper path; `*` stands for any one key). */
function hasPath(node: unknown, path: readonly string[]): boolean {
  if (path.length === 0) return true
  if (typeof node !== 'object' || node === null) return false
  const [first, ...rest] = path
  const values = first === '*' ? Object.values(node) : [(node as Record<string, unknown>)[first]]
  return values.some((value) => value !== undefined && hasPath(value, rest))
}

/** The paths of `paths` (dotted, `*` for any one key) that `theme` does not have: an option given for them does nothing. */
export function findMissingPaths(theme: object, paths: Iterable<string>): string[] {
  return [...paths].filter((path) => !hasPath(theme, path.split('.')))
}

/** Turns a theme into variable references and the declarations that give them values. */
export function createTokens<T extends object>(theme: T, options: TokenOptions = {}): Tokens<T> {
  const { prefix = '', rawKeys = DEFAULT_RAW_KEYS, lengthKeys = DEFAULT_LENGTH_KEYS } = options
  const modes = new Map(Object.entries(options.modes ?? {}))
  const registered = new Map(Object.entries(options.registered ?? {}))
  const parents = collectParents(modes)
  const patterns = collectPatterns(modes)
  const patternParents = [...parents]
    .map((parent) => parent.split('.'))
    .filter((parts) => parts.includes('*'))

  const toName = (path: readonly string[]) =>
    `--${[prefix, ...path.map(toSegment)].filter(Boolean).join('-')}`

  /** The mode of the token at `path`: the longest path in `modes` (an exact path before a pattern), else `rawKeys`, else variable. */
  const readMode = (path: readonly string[]): TokenMode => {
    // Without a pattern the exact paths are all there is to read.
    const mode = patterns.length === 0 ? findByPath(modes, path) : findMode(modes, patterns, path)
    if (mode !== undefined) return mode
    return rawKeys.includes(path[0]) ? 'raw' : 'variable'
  }

  /** Whether everything under `path` keeps its real value: one mode that writes no variable, and no entry deeper down. */
  const isKept = (path: readonly string[]): boolean => {
    const mode = readMode(path)
    const hasDeeper =
      (parents.size > 0 && parents.has(path.join('.'))) ||
      patternParents.some((parts) => matchesPattern(parts, path))
    return (mode === 'raw' || mode === 'inline') && !hasDeeper
  }

  /** Whether `value` is a number under a length key: it is a length, written in px unless it is 0. */
  const isLengthValue = (path: readonly string[], value: string | number): boolean =>
    typeof value === 'number' && lengthKeys.includes(path[0])

  /** The value a variable at `path` holds: a number under a length key is in px. */
  const toDeclared = (path: readonly string[], value: string | number): string =>
    isLengthValue(path, value) && value !== 0 ? `${value}px` : String(value)

  const collect = (node: unknown, path: string[], found: Declared[]): void => {
    if (path.length > 0 && isKept(path)) return
    if (Array.isArray(node)) {
      node.forEach((item, index) => collect(item, [...path, String(index)], found))
    } else if (isPlainObject(node)) {
      for (const [key, value] of Object.entries(node)) collect(value, [...path, key], found)
    } else if (isLeaf(node)) {
      const mode = readMode(path)
      if (mode === 'variable' || mode === 'reference') {
        found.push({
          name: toName(path),
          path: path.join('.'),
          value: toDeclared(path, node),
          source: node,
          isLength: isLengthValue(path, node),
        })
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

  // The `@property` rule of each registered variable of the base theme.
  const registrations: Record<string, string> = {}
  for (const token of baseTokens) {
    const syntax = findByPath(registered, token.path.split('.'))
    if (syntax === undefined) continue
    registrations[token.name] = createPropertyRule(token, syntax)
  }

  const toRef = (path: readonly string[], node: string | number): string | number => {
    const mode = readMode(path)
    const name = toName(path)
    if (mode === 'variable') return `var(${name})`
    if (mode !== 'reference') return node
    const fallback = baseDeclarations[name]
    const fallbackText = fallback === undefined ? '' : `, ${fallback}`
    return `var(${name}${fallbackText})`
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
    registrations,
    createView: (realTheme) => toRefs(realTheme, []) as T,
    findNames: (wanted) =>
      baseTokens
        .filter(({ path }) => wanted.some((one) => path === one || path.startsWith(`${one}.`)))
        .map(({ name }) => name),
  }
}
