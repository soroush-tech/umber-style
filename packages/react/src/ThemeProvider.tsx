import { createElement, type ReactElement } from 'react'
import type { ThemeValueProviderProps } from './ThemeValue'
import type { ColorScheme, DeepPartial } from '@umber-style/core'
import type { WebThemeProviderProps } from './types'

export interface ThemeProviderParts<T> {
  /** Gives the engine its base theme when it has none. */
  learnTheme(theme: DeepPartial<T>): void
  scopeClass(): string
  themeClass(theme: DeepPartial<T>, colorScheme?: ColorScheme): string
  ThemeValueProvider(props: ThemeValueProviderProps<T>): ReactElement
}

/**
 * Makes the web `ThemeProvider`: an element that carries the theme class, around the part that holds
 * the real values. With `isRoot` it renders no element, no class and no rule: it gives the engine its
 * base theme and feeds the context. The app puts `themeClass(theme, colorScheme)` on an ancestor of
 * its own, usually `<html>`, which makes the rule, so that the class can change without a render. Why:
 * the wrapper of a normal provider declares the whole theme below the element that has the class, and
 * so hides a class that the app changes above it.
 */
export function createThemeProvider<T>({
  learnTheme,
  themeClass,
  scopeClass,
  ThemeValueProvider,
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
    if (isRoot) {
      learnTheme(theme)
      return child
    }
    const scope = [themeClass(theme, colorScheme), scopeClass(), className]
      .filter(Boolean)
      .join(' ')
    return createElement(Element, { className: scope }, child)
  }
}
