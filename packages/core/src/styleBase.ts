import type { StyleFunction, StyleInput, StyleResult } from './types'

/** Whether `style` is a function style. */
export function isStyleFunction(style: StyleInput): style is StyleFunction<never, never> {
  return typeof style === 'function'
}

/** Whether a style result adds no declaration of its own: nothing, an object with no key but `label`, or a list of such results. */
function isEmptyResult(result: StyleResult): boolean {
  if (Array.isArray(result)) return result.every(isEmptyResult)
  return !result || Object.keys(result).every((key) => key === 'label')
}

/**
 * The argument of the style functions of one element in one render: the props with `theme`, one object
 * made here and given to each of them, never kept. With `isFrozen` (the development checks) it is frozen,
 * so that a function that assigns or deletes a key of it throws in strict mode code.
 */
export function createStyleArgument(
  props: Record<string, unknown>,
  theme: unknown,
  isFrozen: boolean
): Record<string, unknown> {
  const argument = { ...props, theme }
  return isFrozen ? Object.freeze(argument) : argument
}

/** The message of a `TypeError` of a write into a frozen object, in the words of the JavaScript engines. */
const FROZEN_WRITE =
  /read[- ]?only|not extensible|non-configurable|cannot delete|unable to delete|redefine/i

/**
 * `style` called with `argument`, which the development checks froze: a `TypeError` of a write into a
 * frozen object is thrown again, its message after `owner` (`[css] A style function of "Box"`), with the
 * advice to copy the argument, and the first error as its `cause`. Any other error is thrown as it is.
 * For the development checks only: without them a binding calls the function directly.
 */
export function callCheckedStyle<A, R>(style: (argument: A) => R, argument: A, owner: string): R {
  try {
    return style(argument)
  } catch (error) {
    if (!(error instanceof TypeError) || !FROZEN_WRITE.test(error.message)) throw error
    throw new TypeError(
      `${owner} threw a TypeError of a write into a frozen object: ${error.message}. In development the argument of a style function is frozen: it is one object, the props with the theme, shared by the style functions of the element in a render. Copy the argument before changing it: const own = { ...props }.`,
      { cause: error }
    )
  }
}

/**
 * The base of a style list, for one theme view: the longest run from the start of items that do not
 * depend on props, which are plain objects and functions that read nothing but `theme` (each is called
 * once here, with the props of this call, and its result is what goes into the base). `propsFrom` is the
 * index of the first item that depends on props, or the length of the list when none does. When there is
 * a props part, the empty results at the end of the base (the label of the component, which stands right
 * before it) are left out, so that the base is the same one for a component and for one that wraps it.
 *
 * The functions are given one argument, `{ ...props, theme: view }`, wrapped so that every read of a key
 * other than `theme` is noted, and so is every way of listing them (a spread, `Object.keys`, `in`): such a
 * function may depend on the props. The view is passed as it is, never wrapped. What the function reads
 * is the real props, so what it does (a throw included) is unchanged. With `owner` (the development
 * checks) the argument is frozen and each call is `callCheckedStyle`, which names `owner`.
 */
export function splitLeading(
  list: readonly StyleInput[],
  props: Record<string, unknown>,
  view: unknown,
  owner?: string
): { base: StyleResult[]; propsFrom: number } {
  let isDependent = false
  const note = (key: string | symbol): void => {
    if (key !== 'theme') isDependent = true
  }
  const tracked = new Proxy(createStyleArgument(props, view, owner !== undefined), {
    get(target, key, receiver) {
      note(key)
      return Reflect.get(target, key, receiver)
    },
    has(target, key) {
      note(key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      isDependent = true
      return Reflect.ownKeys(target)
    },
    getOwnPropertyDescriptor(target, key) {
      note(key)
      return Reflect.getOwnPropertyDescriptor(target, key)
    },
  })
  const base: StyleResult[] = []
  let propsFrom = 0
  for (; propsFrom < list.length; propsFrom++) {
    const style = list[propsFrom]
    if (!isStyleFunction(style)) {
      base.push(style)
      continue
    }
    // A read of a prop ends the run, so the note is false at each call of the run.
    const call = style as StyleFunction<unknown, Record<string, unknown>>
    const result =
      owner === undefined ? call(tracked as never) : callCheckedStyle(call, tracked as never, owner)
    if (isDependent) break
    base.push(result)
  }
  if (propsFrom < list.length) {
    while (base.length > 0 && isEmptyResult(base.at(-1))) base.pop()
  }
  return { base, propsFrom }
}
