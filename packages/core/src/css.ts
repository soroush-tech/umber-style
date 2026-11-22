import type { Cache } from './cache'
import type { Styler } from './createEngine'
import { mergeStyles, type StyleObject } from './serialize'
import { flattenStyle, readEntryStyle, type SheetEntry } from './sheetEntry'
import { isTemplateStrings, parseStyleTemplate } from './templateStyle'
import type { StyleInput } from './types'
import type { WebStyleObject } from './webStyle'

/** Whether `value`, or an item of a list in it, is a function. */
function hasFunction(value: unknown): boolean {
  return typeof value === 'function' || (Array.isArray(value) && value.some(hasFunction))
}

/**
 * The style of `args` when they are a tagged template (`caller` was used as a tag), read as CSS text;
 * undefined when they are not. `caller` has no props, so a function among the interpolations is a
 * `TypeError` that names it.
 */
export function readStaticTemplate(
  args: readonly unknown[],
  caller: string
): StyleObject | undefined {
  const [first, ...values] = args
  if (!isTemplateStrings(first)) return undefined
  const parsed = parseStyleTemplate(first, values)
  if (typeof parsed === 'function') {
    throw new TypeError(
      `${caller}(): an interpolation of this template is a function, which needs props, and ${caller}() has none. Use the template with styled, or call the function yourself and interpolate what it returns.`
    )
  }
  return parsed
}

/**
 * Throws a `TypeError` that names `caller` when an argument, or an item of a list among them, is a
 * function: `caller` has no props to call it with.
 */
export function rejectFunctions(args: readonly unknown[], caller: string): void {
  if (args.some(hasFunction)) {
    throw new TypeError(
      `${caller}(): a function is not a style here, because ${caller}() has no props. Give it to styled, or call it yourself and pass what it returns.`
    )
  }
}

/**
 * The style of the arguments of `css()`: a tagged template read as CSS text, or style objects, `css()`
 * results and sheet entries, with lists flattened and `false`, `null` and `undefined` dropped, merged in
 * order, the last winning. An entry that a framework merged into an object is found with `findEntry`.
 * Throws a `TypeError` for a function, for a string, and for an entry that is only a class name.
 */
export function readCssStyle(
  args: readonly unknown[],
  findEntry?: (className: string) => SheetEntry | undefined
): StyleObject {
  const template = readStaticTemplate(args, 'css')
  if (template) return template
  rejectFunctions(args, 'css')
  return mergeStyles(
    flattenStyle(args, findEntry).map((item) => readEntryStyle(item, 'css') as StyleObject)
  )
}

/**
 * `css()` of a web binding over `cache`: one sheet entry of the merged style (see `readCssStyle`). Its
 * class name is worked out now and its rule is written when the entry is first used, as an entry of a
 * sheet; equal styles give the same class.
 */
export function createCssEntry(cache: Cache, args: readonly unknown[]): SheetEntry {
  return cache.createEntry(readCssStyle(args, cache.findEntry) as WebStyleObject)
}

/**
 * The styles of a call of the function that `styled(tag)` returns: as a tag, the template is one style
 * (an object, or a function of the props when an interpolation is a function); else the styles given,
 * with lists flattened.
 */
export function readStyleArguments(args: readonly unknown[]): StyleInput[] {
  const [first, ...values] = args
  if (isTemplateStrings(first)) return [parseStyleTemplate(first, values) as StyleInput]
  return args.flat(Infinity) as StyleInput[]
}

/**
 * The `toString` of a styled component, which makes it a selector in a template or a key
 * (`${Button}:hover &`): `.` and a class that every element of the component has. That is the
 * component's own `target` when it was given one (each class of it, when it holds several); else, when none of its styles is a function, its class
 * (the base class, the same for every element); else there is none, and it throws a `TypeError` that says
 * to give the component a `target`.
 */
export function createComponentSelector(
  target: string | undefined,
  styler: Pick<Styler, 'isDynamic' | 'getClassName'>
): () => string {
  return () => {
    if (target) return `.${target.trim().replaceAll(/\s+/g, '.')}`
    const className = styler.isDynamic ? '' : styler.getClassName({})
    if (className === '') {
      throw new TypeError(
        'A styled component used as a selector needs a class that every element of it has: give it a `target` (styled(tag, { target: "my-button" })), or write its styles without functions.'
      )
    }
    return `.${className}`
  }
}
