export interface TokenOptions {
  /** Put before every variable name, e.g. 'ds' gives --ds-palette-primary. */
  prefix?: string
  /** Top-level theme keys that stay real values and get no variable. Default ['breakpoints', 'components']. */
  rawKeys?: readonly string[]
  /** Top-level theme keys whose numbers are lengths, declared with px. Default ['space', 'sizes', 'radii', 'fontSizes', 'borderWidths']. */
  lengthKeys?: readonly string[]
}

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export interface Tokens<T> {
  /** The theme's shape, with var(--name) in place of each string or number leaf. */
  refs: T
  /** The variable declarations of `theme`, which may be a partial theme: only the leaves it has. */
  declare(theme: DeepPartial<T>): Record<string, string>
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

/** Turns a theme into variable references and the declarations that give them values. */
export function createTokens<T extends object>(theme: T, options: TokenOptions = {}): Tokens<T> {
  const { prefix = '', rawKeys = DEFAULT_RAW_KEYS, lengthKeys = DEFAULT_LENGTH_KEYS } = options

  const toName = (path: readonly string[]) =>
    `--${[prefix, ...path.map(toSegment)].filter(Boolean).join('-')}`

  const isRaw = (path: readonly string[], key: string) => path.length === 0 && rawKeys.includes(key)

  const toRefs = (node: unknown, path: string[]): unknown => {
    if (Array.isArray(node)) {
      return node.map((item, index) => toRefs(item, [...path, String(index)]))
    }
    if (isPlainObject(node)) {
      return Object.fromEntries(
        Object.entries(node).map(([key, value]) => [
          key,
          isRaw(path, key) ? value : toRefs(value, [...path, key]),
        ])
      )
    }
    return isLeaf(node) ? `var(${toName(path)})` : node
  }

  const collect = (node: unknown, path: string[], declarations: Record<string, string>): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => collect(item, [...path, String(index)], declarations))
    } else if (isPlainObject(node)) {
      for (const [key, value] of Object.entries(node)) {
        if (!isRaw(path, key)) collect(value, [...path, key], declarations)
      }
    } else if (isLeaf(node)) {
      const isLength = typeof node === 'number' && node !== 0 && lengthKeys.includes(path[0])
      declarations[toName(path)] = isLength ? `${node}px` : String(node)
    }
  }

  return {
    refs: toRefs(theme, []) as T,
    declare(partial) {
      const declarations: Record<string, string> = {}
      collect(partial, [], declarations)
      return declarations
    },
  }
}
