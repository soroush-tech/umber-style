import { createElement, Fragment, type ReactElement } from 'react'
import { resolveThemeInput, type DeepPartial, type Engine } from '@umber-style/core'
import type { ServerOnlyContext } from './serverContext'
import { createStampElement, createStyleElements } from './styleElements'
import type { WebThemeProviderProps } from './types'

/** What the provider of the server build reads of the request: its slots, and the root theme. */
export interface ServerProviderParts<T> {
  root: ServerOnlyContext<DeepPartial<T> | undefined>
  stamp: ServerOnlyContext<boolean>
  /** The root theme of the request merged over the base theme (the base theme, or an empty object, before a provider gave one). */
  readTheme(): T
  /** `rootTheme` merged over the base theme, made once for each object. */
  mergeRoot(rootTheme: DeepPartial<T>): T
}

/**
 * Makes the `ThemeProvider` for server components, with the `<style>` of its rules. It does not give the
 * theme to client components: a theme holds functions, which cannot cross to them. A client component
 * that calls `useTheme()` needs a `ThemeProvider` imported in a client file. There is no context here,
 * so the first provider that renders in a request is the outermost one: it gives the root theme that
 * function styles read, renders no element, and sends the rule that declares its theme on `:root`. A
 * later one is nested: it renders its wrapper, with the theme class of the theme it was given (no
 * context tells it which providers are between it and the root, so it declares only that) and the scope
 * class. A function theme reads the root theme of the request. With `isRoot` it renders no element and
 * makes no rule: it sends the style of the theme classes that the app already made for its theme with
 * `themeClass`, the class it put on an ancestor. The first provider of a request also renders the stamp
 * of the cache options (a `<meta>`), once.
 */
export function createThemeProvider<T extends object>(
  engine: Engine<T>,
  { root, stamp, readTheme, mergeRoot }: ServerProviderParts<T>
) {
  return function ThemeProvider({
    theme,
    colorScheme,
    className,
    as = 'div',
    isRoot,
    children,
  }: WebThemeProviderProps<T>): ReactElement {
    const isOutermost = !root.slot().isSet
    const given = resolveThemeInput(theme, readTheme())
    const provided = createElement(root.Provider, { value: given }, children)
    // One stamp for the request, from the first provider that renders.
    const slot = stamp.slot()
    const stamped = slot.isSet ? [] : [createStampElement(engine.cache)]
    slot.isSet = true
    if (!engine.hasTheme) engine.setTheme(given as T)
    // A root provider renders no element: the app puts the class on an ancestor, and the rules it made are sent.
    if (isRoot) {
      const made = createStyleElements(engine.cache, engine.findThemeIds(given).join(' '))
      return createElement(Fragment, null, ...stamped, ...made, provided)
    }
    if (isOutermost) {
      const id = engine.declareRoot(mergeRoot(given), colorScheme)
      return createElement(
        Fragment,
        null,
        ...stamped,
        ...createStyleElements(engine.cache, id),
        provided
      )
    }
    const scope = [engine.themeClass(given, colorScheme), engine.scopeClass(), className]
    const props = { className: scope.filter(Boolean).join(' ') }
    return createElement(
      Fragment,
      null,
      ...stamped,
      // The markers have no rules, and so no element.
      ...createStyleElements(engine.cache, props.className),
      createElement(as, props, provided)
    )
  }
}
