import { isAlphaColor, type AlphaColor } from './alpha'
import { hashString } from './hash'
import { DEFAULT_SCOPING } from './scope'
import { compileRules, mergeStyles, type StyleObject } from './serialize'
import { createStandIn, readStandIn } from './standIn'
import type { TemplateValue } from './styleTypes'
import { isTemplateStrings, parseKeyframesTemplate } from './templateStyle'
import type { WebProperties } from './webStyle'

/** One step of an animation: properties and custom properties, written as in a style. It holds no nested style. */
export type KeyframesStep = WebProperties & {
  [key: `--${string}`]: string | number | AlphaColor | null | undefined | false
}

/** The steps of an animation, by offset: `from`, `to`, a percentage (`'50%'`), or a comma list of them (`'0%, 100%'`). */
export type KeyframesSteps = Record<string, KeyframesStep>

/** What `keyframes` is given: the steps, or a function of the theme that returns them. */
export type KeyframesInput<T> = KeyframesSteps | ((theme: T) => KeyframesSteps)

export interface KeyframesOptions {
  /** The first part of the name, for a readable name in the developer tools. Default `keyframes`. */
  label?: string
}

const DEFAULT_LABEL = 'keyframes'
const LABEL_PATTERN = /^[A-Za-z_][\w-]*$/
const OFFSET_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)%$/
const ANIMATION = 'animation'
const NAME_SUFFIX = '-name:'
const NONE: readonly string[] = []

// The steps of every name that `keyframes` returned. A name is a hash of the steps, so it is the same in
// every engine and is kept for the process: an engine made later knows the names made before it.
const registry = new Map<string, KeyframesInput<never>>()

/** The value of `key` in a step, with a stand-in (alone or in a list) turned into its path; a nested style is a `TypeError`. */
function readStepValue(offset: string, key: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => readStandIn(item))
  const read = readStandIn(value)
  if (typeof read !== 'object' || read === null || isAlphaColor(read)) return read
  throw new TypeError(
    `keyframes(): the step "${offset}" holds "${key}", a nested style (a selector or an at-rule). A step is flat: it holds declarations only.`
  )
}

/** The offset of one part of a step key, from 0 to 100; a `TypeError` for anything else. */
function readOffset(part: string, key: string): number {
  if (part === 'from') return 0
  if (part === 'to') return 100
  const offset = OFFSET_PATTERN.test(part) ? Number.parseFloat(part) : Number.NaN
  if (!(offset <= 100)) {
    throw new TypeError(
      `keyframes(): "${key}" is not a step: use from, to, a percentage from 0% to 100%, or a comma list of them.`
    )
  }
  return offset
}

/** The steps by offset, sorted: comma lists expanded, `from` and `to` as 0% and 100%, steps of one offset merged with the later one winning. */
function normalizeSteps(steps: KeyframesSteps): [number, StyleObject][] {
  if (typeof steps !== 'object' || steps === null) {
    throw new TypeError('keyframes(): the steps must be an object, or a function that returns one.')
  }
  const merged = new Map<number, StyleObject>()
  for (const [key, step] of Object.entries(steps)) {
    if (typeof step !== 'object' || step === null) {
      throw new TypeError(`keyframes(): the step "${key}" must be an object of declarations.`)
    }
    const flat: StyleObject = {}
    for (const [name, value] of Object.entries(step)) {
      flat[name] = readStepValue(key, name, value) as StyleObject[string]
    }
    for (const part of key.split(',')) {
      const offset = readOffset(part.trim(), key)
      const earlier = merged.get(offset)
      merged.set(offset, earlier ? mergeStyles([earlier, flat]) : flat)
    }
  }
  return [...merged].sort(([first], [second]) => first - second)
}

/** The body of a `@keyframes` rule: each step that declares something, sorted, written as the rule of a class. */
function compileSteps(
  steps: KeyframesSteps,
  hasColorFallbacks: boolean,
  hasValueRepair: boolean
): string {
  return normalizeSteps(steps)
    .flatMap(([offset, step]) =>
      compileRules(`${offset}%`, step, hasColorFallbacks, DEFAULT_SCOPING, hasValueRepair)
    )
    .join('')
}

/**
 * Registers an animation and returns its name, `<label>-<hash>`, at once: nothing is written until a
 * class that names it in `animation` or `animation-name` is inserted. The hash is made from the steps
 * alone, so it does not depend on the theme, the prefix or the token options; a function of the theme is
 * called for it with a stand-in theme whose every token is its own path as text. Equal steps give the same
 * name. As a tag, the template is read as steps (`parseKeyframesTemplate`), and gives the name of the
 * equal object. Throws a `TypeError` for a step that is not one, a nested style in a step, or a label
 * that is not an identifier.
 */
// A function first, the template, then the steps, last: see the forms of `styled` in a binding.
export function keyframes<T = never>(
  steps: (theme: T) => KeyframesSteps,
  options?: KeyframesOptions
): string
export function keyframes<T = never>(
  template: TemplateStringsArray,
  ...values: TemplateValue<unknown, T>[]
): string
export function keyframes<T = never>(steps: KeyframesInput<T>, options?: KeyframesOptions): string
export function keyframes<T = never>(
  first: KeyframesInput<T> | TemplateStringsArray,
  ...rest: unknown[]
): string {
  if (isTemplateStrings(first)) return keyframes(parseKeyframesTemplate<T>(first, rest))
  const steps = first as KeyframesInput<T>
  const { label = DEFAULT_LABEL } = (rest[0] ?? {}) as KeyframesOptions
  if (!LABEL_PATTERN.test(label)) {
    throw new TypeError(
      `keyframes(): the label "${label}" is not an identifier: use letters, digits, '-' and '_', not starting with a digit or '-'.`
    )
  }
  const isThemed = typeof steps === 'function'
  const resolved = isThemed ? steps(createStandIn('') as T) : steps
  const name = `${label}-${hashString((isThemed ? 'theme:' : '') + compileSteps(resolved, true, false))}`
  if (!registry.has(name)) registry.set(name, steps as KeyframesInput<never>)
  return name
}

/** Whether `name` is a name that `keyframes` returned. */
export function isKeyframesName(name: string): boolean {
  return registry.has(name)
}

/**
 * The `@keyframes` rule of the registered `name`: steps given as a function are resolved against the
 * theme that `readTheme` gives, which is read only then.
 */
export function createKeyframesRule(
  name: string,
  readTheme: () => unknown,
  hasColorFallbacks: boolean,
  hasValueRepair: boolean
): string {
  const steps = registry.get(name) as KeyframesInput<unknown>
  const resolved = typeof steps === 'function' ? steps(readTheme()) : steps
  return `@keyframes ${name}{${compileSteps(resolved, hasColorFallbacks, hasValueRepair)}}`
}

/** Adds to `names` each identifier of `value` that is a registered name. */
function addRegistered(value: string, names: string[]): void {
  for (const word of value.split(/[^\w-]+/)) {
    if (registry.has(word) && !names.includes(word)) names.push(word)
  }
}

/** Where the value starts when the `animation` at `index` of `rule` begins an `animation` or `animation-name` declaration, else -1. */
function findValueStart(rule: string, index: number): number {
  const before = rule[index - 1]
  if (before !== '{' && before !== ';') return -1
  const after = index + ANIMATION.length
  if (rule[after] === ':') return after + 1
  return rule.startsWith(NAME_SUFFIX, after) ? after + NAME_SUFFIX.length : -1
}

/**
 * The registered names that the `animation` and `animation-name` declarations of `rules` (compiled rules,
 * whose declarations each end with `;`) use, in nested selectors and at-rules too, matched as whole
 * identifiers. Nothing is read while no name is registered.
 */
export function findAnimationNames(rules: readonly string[]): readonly string[] {
  if (registry.size === 0) return NONE
  const names: string[] = []
  for (const rule of rules) {
    let index = rule.indexOf(ANIMATION)
    while (index !== -1) {
      const start = findValueStart(rule, index)
      if (start !== -1) {
        index = rule.indexOf(';', start)
        addRegistered(rule.slice(start, index), names)
      }
      index = rule.indexOf(ANIMATION, index + 1)
    }
  }
  return names
}
