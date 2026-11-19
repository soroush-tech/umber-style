import { createElement, Fragment, type ReactElement } from 'react'
import type { DeepPartial, Engine } from '@umber-style/core'
import type { ServerOnlyContext } from './serverContext'
import { createStyleElements } from './styleElements'
import type { WebThemeProviderProps } from './types'

/**
 * Makes the `ThemeProvider` for server components: an element with the theme class and its `<style>`.
 * It does not give the theme to client components: a theme holds functions, which cannot cross to
 * them. A client component that calls `useTheme()` needs a `ThemeProvider` imported in a client file.
 * The first provider of a request also gives the root theme that function styles read. A root provider
 * (`isRoot`) renders no element and makes no rule: it sends the style of the theme classes that the app
 * already made for its theme with `themeClass`, which is the class it put on an ancestor.
 */
export function createThemeProvider<T extends object>(
  engine: Engine<T>,
  root: ServerOnlyContext<DeepPartial<T> | undefined>
) {
  return function ThemeProvider({
    theme,
    colorScheme,
    className,
    as = 'div',
    isRoot,
    children,
  }: WebThemeProviderProps<T>): ReactElement {
    const provided = createElement(root.Provider, { value: theme }, children)
    // A root provider renders no element: the app puts the class on an ancestor, and the rules it made are sent.
    if (isRoot) {
      if (!engine.hasTheme) engine.setTheme(theme as T)
      const made = createStyleElements(engine.cache, engine.findThemeIds(theme).join(' '))
      return createElement(Fragment, null, ...made, provided)
    }
    const scope = engine.themeClass(theme, colorScheme)
    // The rules are keyed by the theme class alone; the markers have none.
    const styles = createStyleElements(engine.cache, engine.themeId(theme, colorScheme))
    const scoped = engine.scopeClass()
    const props = { className: [scope, scoped, className].filter(Boolean).join(' ') }
    return createElement(
      Fragment,
      null,
      ...styles,
      ...createStyleElements(engine.cache, scoped),
      createElement(as, props, provided)
    )
  }
}
