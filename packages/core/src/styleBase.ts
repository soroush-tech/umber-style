import type { StyleFunction, StyleInput, StyleResult } from './types'

/** Whether `style` is a function style. */
export function isStyleFunction(style: StyleInput): style is StyleFunction<never, never> {
  return typeof style === 'function'
}

/** Whether a style result adds no declaration of its own: nothing, or an object with no key but `label`. */
function isEmptyResult(result: StyleResult): boolean {
  return !result || Object.keys(result).every((key) => key === 'label')
}

/**
 * Calls `style` with the props and the theme view, the props wrapped so that every read of a key other
 * than `theme` is noted, and so is every way of listing them (a spread, `Object.keys`, `in`): such a
 * function may depend on the props. The view is passed as it is, never wrapped. What the function reads
 * is the real props, so what it does (a throw included) is unchanged.
 */
function callTracked(
  style: StyleFunction<unknown, Record<string, unknown>>,
  props: Record<string, unknown>,
  view: unknown
): { result: StyleResult; isDependent: boolean } {
  let isDependent = false
  const note = (key: string | symbol): void => {
    if (key !== 'theme') isDependent = true
  }
  const tracked = new Proxy(
    { ...props, theme: view },
    {
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
    }
  )
  const result = style(tracked as { theme: unknown } & Record<string, unknown>)
  return { result, isDependent }
}

/**
 * The base of a style list, for one theme view: the longest run from the start of items that do not
 * depend on props, which are plain objects and functions that read nothing but `theme` (each is called
 * once here, with the props of this call, and its result is what goes into the base). `propsFrom` is the
 * index of the first item that depends on props, or the length of the list when none does. When there is
 * a props part, the empty results at the end of the base (the label of the component, which stands right
 * before it) are left out, so that the base is the same one for a component and for one that wraps it.
 */
export function splitLeading(
  list: readonly StyleInput[],
  props: Record<string, unknown>,
  view: unknown
): { base: StyleResult[]; propsFrom: number } {
  const base: StyleResult[] = []
  let propsFrom = 0
  for (; propsFrom < list.length; propsFrom++) {
    const style = list[propsFrom]
    if (!isStyleFunction(style)) {
      base.push(style)
      continue
    }
    const { result, isDependent } = callTracked(
      style as StyleFunction<unknown, Record<string, unknown>>,
      props,
      view
    )
    if (isDependent) break
    base.push(result)
  }
  if (propsFrom < list.length) {
    while (base.length > 0 && isEmptyResult(base.at(-1))) base.pop()
  }
  return { base, propsFrom }
}
