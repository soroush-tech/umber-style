import { createElement, type ElementType } from 'react'
import { readThemedSource, type ThemedSource } from '@umber-style/core/internal'
import type { NativeCondition } from './conditions'
import type { NativeStyleObject } from './nativeStyle'
import { useMediaKey } from './windowState'

/** What a sheet made from a function of the theme has on React Native, for the handles read from it. */
interface HandleSheet {
  /** The sheet as registered for `theme`: its media queries, and whether an entry has a `whenScheme()` key. */
  prepare(theme: unknown): { queries: readonly string[]; hasScheme: boolean }
  /** The entries for `theme`, the providers of `condition` and the window now. */
  resolve(theme: unknown, condition?: NativeCondition): Record<string, NativeStyleObject>
}

/** The props of the component that resolves the handles of `style`: the props of the styled component, and that component. */
interface ThemedStyleProps {
  props: Record<string, unknown>
  component: ElementType
}

/** Whether `style`, or a list in it at any depth, holds a handle of a sheet made from a function of the theme. */
export function hasThemedEntry(style: unknown): boolean {
  if (Array.isArray(style)) return style.some(hasThemedEntry)
  return readThemedSource(style) !== undefined
}

/** Adds to `found` the source of every handle in `style`, in order. */
function collectSources(style: unknown, found: ThemedSource[]): void {
  if (Array.isArray(style)) {
    for (const item of style) collectSources(item, found)
    return
  }
  const source = readThemedSource(style)
  if (source) found.push(source)
}

/** `style` with each handle in it replaced by what `resolve` gives for it; lists keep their shape. */
function replaceHandles(style: unknown, resolve: (source: ThemedSource) => unknown): unknown {
  if (Array.isArray(style)) return style.map((item) => replaceHandles(item, resolve))
  const source = readThemedSource(style)
  return source ? resolve(source) : style
}

/** `lists` joined, each item once, in order. */
function joinItems<T>(lists: readonly (readonly T[])[]): T[] {
  return [...new Set(lists.flat())]
}

/**
 * Makes the component that a styled component renders through when its `style` holds a handle
 * (`sheet.card`): it reads the theme and the providers once, as `useStyle` does, subscribes to the window
 * and the color scheme for the media and `whenScheme()` keys of the sheets of those handles with the
 * same `useMediaKey` path, and renders the styled component again with each handle replaced by its
 * registered entry, so that the entry follows a rotation. Its hooks are the same in every render,
 * whatever the number of handles.
 */
export function createThemedStyle(
  useTheme: () => unknown,
  useCondition: () => NativeCondition,
  remBase: number
) {
  return function ThemedStyle({ props, component }: ThemedStyleProps) {
    const theme = useTheme()
    const condition = useCondition()
    const sources: ThemedSource[] = []
    collectSources(props.style, sources)
    const prepared = sources.map((source) => (source.sheet as HandleSheet).prepare(theme))
    const queries = joinItems(prepared.map((sheet) => sheet.queries))
    const hasScheme = prepared.some((sheet) => sheet.hasScheme)
    useMediaKey(queries, hasScheme && condition.colorScheme === undefined, remBase)
    const style = replaceHandles(props.style, ({ sheet, key }) => {
      const entry = (sheet as HandleSheet).resolve(theme, condition)[key]
      if (entry === undefined) throw new TypeError(`The sheet has no style named "${key}".`)
      return entry
    })
    return createElement(component, { ...props, style })
  }
}
