'use client'

import {
  createElement,
  Fragment,
  use,
  useContext,
  useInsertionEffect,
  useMemo,
  type ReactElement,
} from 'react'
import {
  EMPTY_THEME,
  mergeTheme,
  resolveThemeInput,
  type DeepPartial,
  type Engine,
} from '@umber-style/core'
import { useProvidedCache } from './CacheProvider'
import { addMark, getMarksContext, type ThemeScopeValue } from './ProviderScope'
import { readMarkKey, type ThemeContexts } from './ThemeValue'
import type { WebThemeProviderProps } from './types'

/** What a provider needs to render the style of its classes, where the build does that (a server render of the client build). */
export interface ServerStyleParts {
  /** The `<style href precedence>` elements of these classes (or root theme). */
  createStyleElements(className: string): ReactElement[]
  /** The element that carries the options of the cache. */
  createStamp(): ReactElement
}

export interface ThemeProviderParts<T> {
  engine: Engine<T>
  contexts: ThemeContexts<T>
  /** Read at each render: the parts of a render that sends style elements, or undefined where the build inserts into its sheet (the browser). */
  getServerStyle(): ServerStyleParts | undefined
}

/**
 * Makes the web `ThemeProvider`. Its theme (or what a function of the theme above returns) is merged over
 * the theme above and given to the contexts: the real values, and the view that function styles read.
 *
 * - The outermost provider (none above it) renders no element: its theme is declared on `:root`, written
 *   in an insertion effect in the browser (so a change of theme rewrites that rule and renders no styled
 *   component) and during the render where there is no document (a server render). It gives the engine
 *   its base theme when it has none.
 * - A nested provider renders its wrapper: the theme class of the theme it was given (with the boundary
 *   and scheme markers that conditions use), the theme class of its merged theme (every variable, so that
 *   it is right where its element is not inside the wrapper of the provider above, in a portal), and the
 *   scope class, which has `display: contents`.
 * - With `isRoot` it renders no element and makes no rule: the app puts `themeClass(theme)` on an ancestor
 *   of its own, usually `<html>`.
 *
 * On a server, where the build renders style elements, it sends those of its rules, and the stamp.
 *
 * Whether a provider is above is read from the marks that both builds write (`ProviderScope`), by the
 * prefix of the engine's cache: a provider of the server build above makes this one nested too. Its theme
 * is in the same context (the browser part of that provider puts it there, as plain data), so the theme
 * above is the nearest provider's of either build.
 *
 * Under a `CacheProvider` it works with the engine over the cache that the provider gives (the same base
 * theme, the prefix of that cache), sends no style element, and is the outermost one when no provider of
 * that cache is above it: its theme is declared on `:root` in that cache, which is the root of the
 * document of that cache (an iframe's).
 */
export function createThemeProvider<T extends object>({
  engine: baseEngine,
  contexts: { ThemeContext, ViewContext },
  getServerStyle,
}: ThemeProviderParts<T>) {
  return function ThemeProvider({
    theme,
    colorScheme,
    className,
    as = 'div',
    isRoot,
    children,
  }: WebThemeProviderProps<T>): ReactElement {
    const cache = useProvidedCache()
    const engine = cache === undefined ? baseEngine : baseEngine.withCache(cache)
    const MarksContext = getMarksContext()
    const marks = use(MarksContext)
    // A provider of another cache is not of this engine: with none of this one above, it starts its own.
    const key = readMarkKey(baseEngine, cache)
    const above = marks.get(key)
    const outer = useContext(ThemeContext) ?? engine.baseTheme
    const isOutermost = above === undefined && !isRoot
    const isNested = above !== undefined && !isRoot
    const given = useMemo(
      () => resolveThemeInput(theme, outer ?? (EMPTY_THEME as T)),
      [theme, outer]
    )
    // The first provider gives the engine its base theme, before its children render.
    if (!engine.hasTheme) engine.setTheme(given as T)
    const merged = useMemo(() => mergeTheme(outer, given), [outer, given])
    const wrapper = useMemo((): ThemeScopeValue | undefined => {
      if (!isNested) return undefined
      const own = engine.themeClass(given, colorScheme)
      const full = engine.themeId(merged as DeepPartial<T>, colorScheme)
      const names = [own, own.startsWith(`${full} `) ? '' : full, engine.scopeClass(), className]
      return { as, className: names.filter(Boolean).join(' ') }
    }, [engine, isNested, given, merged, colorScheme, className, as])
    const below = useMemo(
      () => addMark(marks, key, { scope: wrapper ?? above?.scope ?? null }),
      [marks, key, wrapper, above]
    )
    useInsertionEffect(() => {
      if (isOutermost) engine.declareRoot(merged, colorScheme)
    }, [engine, isOutermost, merged, colorScheme])
    const hasDocument = typeof document !== 'undefined'
    const rootId = isOutermost && !hasDocument ? engine.declareRoot(merged, colorScheme) : undefined

    const content = (
      <MarksContext.Provider value={below}>
        <ThemeContext.Provider value={merged}>
          <ViewContext.Provider value={engine.createThemeView(merged)}>
            {children}
          </ViewContext.Provider>
        </ThemeContext.Provider>
      </MarksContext.Provider>
    )
    const element = wrapper ? createElement(as, { className: wrapper.className }, content) : content
    // Under a cache provider the app sends the rules of its cache itself.
    const server = cache === undefined ? getServerStyle() : undefined
    if (server === undefined) return element
    // The rules that this provider stands for: its wrapper's classes, its root theme, or for `isRoot` the
    // theme classes that the app already made for its theme.
    const styled = wrapper?.className ?? rootId ?? engine.findThemeIds(given).join(' ')
    return createElement(
      Fragment,
      null,
      server.createStamp(),
      ...server.createStyleElements(styled),
      element
    )
  }
}
