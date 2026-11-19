import { createElement, Fragment, type ReactElement } from 'react'
import type { ThemeValueProviderProps } from './ThemeValue'
import type { ColorScheme, DeepPartial } from '@umber-style/core'
import type { WebThemeProviderProps } from './types'

/** What a provider needs to render the style of its classes, where the build does that (a server render of the client build). */
export interface ServerStyleParts<T> {
  /** The `<style href precedence>` elements of these classes. */
  createStyleElements(className: string): ReactElement[]
  /** The element that carries the options of the cache. */
  createStamp(): ReactElement
  /** The theme classes already made for this theme object. */
  findThemeIds(theme: DeepPartial<T>): string[]
  /** The theme class alone, which the style elements are keyed by. */
  themeId(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
}

export interface ThemeProviderParts<T> {
  /** Gives the engine its base theme when it has none. */
  learnTheme(theme: DeepPartial<T>): void
  scopeClass(): string
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  ThemeValueProvider(props: ThemeValueProviderProps<T>): ReactElement
  /** Read at each render: the parts of a render that sends style elements, or undefined where the build inserts into its sheet (the browser). */
  getServerStyle(): ServerStyleParts<T> | undefined
}

/**
 * Makes the web `ThemeProvider`: an element that carries the theme class, around the part that holds
 * the real values. With `isRoot` it renders no element, no class and no rule: it gives the engine its
 * base theme and feeds the context. The app puts `themeClass(theme, colorScheme)` on an ancestor of
 * its own, usually `<html>`, which makes the rule, so that the class can change without a render. Why:
 * the wrapper of a normal provider declares the whole theme below the element that has the class, and
 * so hides a class that the app changes above it. On a server, where the build renders style elements,
 * the provider sends those of its theme class and the scope class (a root provider: of the theme classes
 * already made for its theme), and the stamp of the cache options.
 */
export function createThemeProvider<T>({
  learnTheme,
  themeClass,
  scopeClass,
  ThemeValueProvider,
  getServerStyle,
}: ThemeProviderParts<T>) {
  return function ThemeProvider({
    theme,
    colorScheme,
    className,
    as: Element = 'div',
    isRoot,
    children,
  }: WebThemeProviderProps<T>): ReactElement {
    const child = <ThemeValueProvider theme={theme}>{children}</ThemeValueProvider>
    const server = getServerStyle()
    if (isRoot) {
      learnTheme(theme)
      if (server === undefined) return child
      const made = server.createStyleElements(server.findThemeIds(theme).join(' '))
      return createElement(Fragment, null, server.createStamp(), ...made, child)
    }
    const scope = [themeClass(theme, colorScheme), scopeClass(), className]
      .filter(Boolean)
      .join(' ')
    const element = createElement(Element, { className: scope }, child)
    if (server === undefined) return element
    return createElement(
      Fragment,
      null,
      server.createStamp(),
      ...server.createStyleElements(server.themeId(theme, colorScheme)),
      ...server.createStyleElements(scopeClass()),
      element
    )
  }
}
