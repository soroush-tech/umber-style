import { isAlphaColor } from './alpha'
import type { StyleObject } from './serialize'

/** How many steps a memo holds before it is emptied: a bound on its memory (`contentMemo.md`). */
export const CONTENT_STEP_LIMIT = 10_000

/** A place in the tree of a memo: the step after it, by key then value, and the class of the style that ends here. */
interface Node {
  next: Map<unknown, Map<unknown, Node>> | undefined
  className: string | undefined
}

/** The value of the step that enters a nested style, and the key and value of the step that leaves it: no key of a style is an object. */
const ENTER = {}
const LEAVE = {}

/** A value that a memo reads: what the compiler writes as text, and the values it leaves out. */
type PlainValue = string | number | null | undefined | false

/** Whether `value` is a nested style made of an object literal (not a list, an `alpha()` value or an instance). */
function isNestedStyle(value: unknown): value is StyleObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null) && !isAlphaColor(value)
}

/** Whether `value` is one the memo reads as it is. */
function isPlainValue(value: unknown): value is PlainValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    value === undefined ||
    value === null ||
    value === false
  )
}

/** What `readNestedValue` gives for a key that is not data: a symbol, which no value of a style is, and no step of a memo has. */
const NOT_DATA = Symbol('not data')

/**
 * The value of the key `key` of a nested style, read from its descriptor, so that a getter is never
 * called: `NOT_DATA` for a getter or a setter.
 */
function readNestedValue(style: StyleObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(style, key) as PropertyDescriptor
  return 'value' in descriptor ? descriptor.value : NOT_DATA
}

/**
 * `style` when every value is a plain value; with nested styles (of plain values, at any depth), a copy
 * that holds a copy of each; undefined when a value is anything else, a nested style has a getter or
 * a setter (whose value can differ from one read to the next), or the key `__proto__`, which a copy
 * cannot hold as a key. The top level is a merged style, which `mergeStyles` made of data alone.
 */
export function readStableStyle(style: StyleObject, isNested = false): StyleObject | undefined {
  const keys = Object.keys(style)
  if (isNested && keys.includes('__proto__')) return undefined
  let copy: StyleObject | undefined = isNested ? {} : undefined
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    const value = isNested ? readNestedValue(style, key) : style[key]
    const stable = readStableValue(value)
    if (stable === NOT_DATA) return undefined
    // A nested style is held as a copy, so the style that holds it is a copy too, from its first key.
    if (copy === undefined && stable !== value) copy = copyFirstKeys(style, keys, index)
    if (copy) copy[key] = stable as StyleObject[string]
  }
  return copy ?? style
}

/** The stable form of one value of a style: the value when it is plain, a copy of a nested style, `NOT_DATA` for anything else. */
function readStableValue(value: unknown): unknown {
  if (isPlainValue(value)) return value
  if (!isNestedStyle(value)) return NOT_DATA
  return readStableStyle(value, true) ?? NOT_DATA
}

/** A style with the first `count` keys of `style`, in order. */
function copyFirstKeys(style: StyleObject, keys: readonly string[], count: number): StyleObject {
  const copy: StyleObject = {}
  for (let index = 0; index < count; index++) copy[keys[index]] = style[keys[index]]
  return copy
}

/**
 * The memo of the classes of merged styles, by their contents: a tree whose steps are the keys of a
 * style, in order, each with its value. A string and a number are told apart as `Map` keys tell them
 * apart, so no text joins two values, and no value can stand for two.
 */
export interface ContentMemo {
  /** The class remembered for `style` made in `layer` after `after` (`''`: it has no rule); undefined when none is. */
  find(layer: string, after: string, style: StyleObject): string | undefined
  /** Remembers `className` for `style`, which `readStableStyle` gave; the memo is emptied first when it is full. */
  remember(layer: string, after: string, style: StyleObject, className: string): void
  /** Forgets every class it holds, as when it is full: the cache calls it when what a compile reads has changed. */
  clear(): void
  /** How many steps it holds now: never more than `CONTENT_STEP_LIMIT` and the steps of one style. */
  readonly size: number
}

/** Makes an empty memo. */
export function createContentMemo(): ContentMemo {
  let roots = new Map<unknown, Map<unknown, Node>>()
  let steps = 0

  /** The node after the step `key`, `value` from `node`; with `isMade`, made when it is not there. */
  const step = (node: Node, key: unknown, value: unknown, isMade: boolean): Node | undefined => {
    let values = node.next?.get(key)
    if (values === undefined) {
      if (!isMade) return undefined
      values = new Map()
      node.next ??= new Map()
      node.next.set(key, values)
    }
    let child = values.get(value)
    if (child !== undefined || !isMade) return child
    child = { next: undefined, className: undefined }
    values.set(value, child)
    steps++
    return child
  }

  /**
   * The node at the end of `style` from `start`; with `isMade`, its steps are made. A nested style is
   * read through its descriptors (`readNestedValue`): a getter is never called, and is no step.
   */
  const walk = (
    start: Node,
    style: StyleObject,
    isMade: boolean,
    isNested = false
  ): Node | undefined => {
    let node: Node | undefined = start
    for (const key of Object.keys(style)) {
      const value = isNested ? readNestedValue(style, key) : style[key]
      if (isNestedStyle(value)) {
        node = step(node, key, ENTER, isMade)
        node = node && walk(node, value, isMade, true)
        node = node && step(node, LEAVE, LEAVE, isMade)
      } else node = step(node, key, value, isMade)
      if (node === undefined) return undefined
    }
    return node
  }

  /** The root node of `layer` and `after`; with `isMade`, made when it is not there. */
  const readRoot = (layer: string, after: string, isMade: boolean): Node | undefined => {
    const holder: Node = { next: roots, className: undefined }
    return step(holder, layer, after, isMade)
  }

  const clear = (): void => {
    roots = new Map()
    steps = 0
  }

  return {
    get size() {
      return steps
    },
    find(layer, after, style) {
      const root = readRoot(layer, after, false)
      return root && walk(root, style, false)?.className
    },
    remember(layer, after, style, className) {
      if (steps >= CONTENT_STEP_LIMIT) clear()
      const end = walk(readRoot(layer, after, true) as Node, style, true) as Node
      end.className = className
    },
    clear,
  }
}
