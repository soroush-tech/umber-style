import type { Cache } from './cache'
import { readPageNonce } from './documentNonce'
import { createThemeRule } from './theme'

const BRAND = Symbol.for('umber-style.live-value')
const UNIT_PATTERN = /^(?:%|[a-z]+)$/i

/**
 * A value that a style reads through a CSS variable: in a style it is the reference to the variable
 * (`${value}`, or an operand of `add`, `subtract`, `multiply`, `divide`, `negate`), so that the class is
 * the same whatever the value holds; `get()` returns the number it holds now. Arithmetic on it is a type
 * error: it is not a number.
 */
export interface LiveValue {
  /** The number the value holds now. */
  get(): number
  /** The reference to the variable, with the first value as its fallback: `var(--<prefix>-value-<id>, 0)`. */
  toString(): string
}

/** What a value holds of its own: the name of its variable, the reference, its unit and its number now. */
interface LiveData {
  readonly name: string
  readonly reference: string
  readonly unit: string
  current: number
}

/** The one `get` and `toString` that every value shares: making a value makes no function. */
const LIVE_PROTOTYPE = {
  [BRAND]: true,
  get(this: LiveData): number {
    return this.current
  },
  toString(this: LiveData): string {
    return this.reference
  },
}

/** Whether `value` was made by `createLiveValue` (of any copy of the core). */
export function isLiveValue(value: unknown): value is LiveValue {
  return typeof value === 'object' && value !== null && BRAND in value
}

/** Throws unless `value` is a finite number. */
function assertNumber(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`useStyleValue(): a value must be a finite number, got ${String(value)}.`)
  }
}

/**
 * Makes a value of the variable `name` that holds `initial`, written with `unit` after it (none: the
 * number as it is, as the engine writes a number for any custom property). Its reference has the
 * first value as its fallback, so a page rendered with no rule for the variable shows it. Throws a
 * `TypeError` for a number that is not finite and for a unit that is not `%` or letters.
 */
export function createLiveValue(name: string, initial: number, unit = ''): LiveValue {
  assertNumber(initial)
  if (unit !== '' && !UNIT_PATTERN.test(unit)) {
    throw new TypeError(
      `useStyleValue(): the unit "${unit}" is not one: use % or letters, such as px.`
    )
  }
  const data: LiveData = Object.create(LIVE_PROTOTYPE)
  Object.assign(data, {
    name,
    reference: `var(${name}, ${initial}${unit})`,
    unit,
    current: initial,
  })
  return data as unknown as LiveValue
}

/** The name of the variable of `value`. */
export function readLiveName(value: LiveValue): string {
  return (value as unknown as LiveData).name
}

/** The text that the variable of `value` declares now: its number, then its unit. */
export function readLiveText(value: LiveValue): string {
  const { current, unit } = value as unknown as LiveData
  return `${current}${unit}`
}

/** Gives `value` the number `next`, and returns the text the variable declares then. Throws a `TypeError` for a number that is not finite. */
export function writeLiveValue(value: LiveValue, next: number): string {
  assertNumber(next)
  ;(value as unknown as LiveData).current = next
  return readLiveText(value)
}

/** The rule of a value in a document: what changes its declaration in place, and what takes it away. */
export interface LiveRule {
  /** Declares `text` as the value of the variable, in the rule that is there. */
  set(text: string): void
  /** Removes the rule from its sheet; a second call does nothing. */
  remove(): void
}

const NO_RULE: LiveRule = { set: () => undefined, remove: () => undefined }

/**
 * The style element of the values of `prefix` in `page`: the one there, else one made in its head with
 * `nonce`, else the nonce of the page (`readPageNonce`), as the elements of the cache's own sheet.
 */
function findValuesElement(page: Document, prefix: string, nonce: string | undefined) {
  const key = `${prefix}-values`
  let element = page.head.querySelector<HTMLStyleElement>(`style[data-style="${key}"]`)
  if (element === null) {
    element = page.createElement('style')
    element.dataset.style = key
    const elementNonce = nonce ?? readPageNonce(page)
    // Set before the element is in the document, which is when a policy checks it.
    if (elementNonce !== undefined) element.setAttribute('nonce', elementNonce)
    page.head.appendChild(element)
  }
  return element
}

/**
 * Declares the variable of `value` with the number it holds, in a rule of its own on `:root`, in the
 * theme layer of `cache` (none without layers), and returns what changes the declaration in place. The
 * rule goes into the style element `data-style="<prefix>-values"` of the document of the cache, made
 * with the nonce of the cache (else of the page), written with `insertRule` so that a change touches that one declaration
 * and parses nothing. Without a document (a server) there is no rule: the fallback of the reference
 * stands for the first value.
 */
export function declareLiveValue(cache: Cache, value: LiveValue): LiveRule {
  const page = cache.document
  if (page === undefined) return NO_RULE
  const name = readLiveName(value)
  const element = findValuesElement(page, cache.prefix, cache.nonce)
  const sheet = element.sheet as CSSStyleSheet
  const text = createThemeRule(
    cache.prefix,
    cache.hasLayers,
    ':root',
    `${name}:${readLiveText(value)};`
  )
  const outer = sheet.cssRules[sheet.insertRule(text, sheet.cssRules.length)]
  // In a layer the declaration is in the rule inside the layer block.
  const declared = (
    cache.hasLayers ? (outer as CSSGroupingRule).cssRules[0] : outer
  ) as CSSStyleRule
  let isRemoved = false
  return {
    set: (next) => declared.style.setProperty(name, next),
    remove: () => {
      if (isRemoved) return
      isRemoved = true
      const parent = outer.parentStyleSheet
      if (parent) parent.deleteRule(Array.prototype.indexOf.call(parent.cssRules, outer))
    },
  }
}
