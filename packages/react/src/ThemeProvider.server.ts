import { createElement, Fragment, type ReactElement } from 'react'
import type { DeepPartial, Engine } from '@umber-style/core'
import type { ServerOnlyContext } from './serverContext'
import { createStyleElements } from './styleElements'
import type { WebThemeProviderProps } from './types'

/**
 * Makes the `ThemeProvider` for server components: an element with the theme class and its `<style>`.
 * It does not give the theme to client components: a theme holds functions, which cannot cross to
 * them. A client component that calls `useTheme()` needs a `ThemeProvider` imported in a client file.
 * The first provider of a request also gives the root theme that function styles read.
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
    const scope = engine.themeClass(theme, colorScheme)
    const provided = createElement(root.Provider, { value: theme }, children)
    // The rules are keyed by the theme class alone; the markers have none.
    const styles = createStyleElements(engine.cache, engine.themeId(theme, colorScheme))
    // A root provider renders no element: the app puts the class on an ancestor, and the rule is still sent.
    if (isRoot) return createElement(Fragment, null, ...styles, provided)
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
