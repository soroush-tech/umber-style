'use client'

import { createContext, useContext, useMemo, type Context, type ReactNode } from 'react'
import {
  type ColorScheme,
  EMPTY_THEME,
  mergeTheme,
  resolveThemeInput,
  type ThemeInput,
} from '@umber-style/core'
import { readSchemeName, type NativeCondition } from './conditions'

export interface ThemeValueProviderProps<T> {
  readonly theme: ThemeInput<T>
  /** The color scheme of this subtree, for `whenScheme`; `light dark` and nothing keep the one above. */
  readonly colorScheme?: ColorScheme
  readonly children?: ReactNode
}

/** Where the base theme lives while no provider is above: set by the outermost provider, or by the app. */
export interface ThemeHolder<T> {
  baseTheme: T | undefined
}

/**
 * The contexts of the engine: the real theme values (`ThemeContext`, made here unless given; the base
 * theme of `holder`, else an empty object, where there is no provider), and what a condition is matched
 * against.
 */
export function createThemeValue<T extends object>(
  holder: ThemeHolder<T>,
  ThemeContext: Context<T | undefined> = createContext<T | undefined>(undefined)
) {
  const ConditionContext = createContext<NativeCondition | undefined>(undefined)

  /** The theme where no provider is above: the base theme, or the empty theme. */
  const readOwnTheme = () => holder.baseTheme ?? (EMPTY_THEME as T)

  function ThemeValueProvider({ theme, colorScheme, children }: ThemeValueProviderProps<T>) {
    const outer = useContext(ThemeContext) ?? holder.baseTheme
    const outerScheme = useContext(ConditionContext)?.colorScheme
    const given = useMemo(
      () => resolveThemeInput(theme, outer ?? (EMPTY_THEME as T)),
      [theme, outer]
    )
    // The outermost provider that renders gives the base theme, as on the web.
    holder.baseTheme ??= given as T
    const value = useMemo(() => mergeTheme(outer, given), [outer, given])
    const scheme = readSchemeName(colorScheme) ?? outerScheme
    const condition = useMemo(() => ({ theme: given, colorScheme: scheme }), [given, scheme])
    return (
      <ThemeContext.Provider value={value}>
        <ConditionContext.Provider value={condition}>{children}</ConditionContext.Provider>
      </ThemeContext.Provider>
    )
  }

  /** The theme of the nearest provider, the base theme, or an empty object. */
  function useTheme(): T {
    return useContext(ThemeContext) ?? readOwnTheme()
  }

  /** What `when()` and `whenScheme()` keys are matched against: the nearest provider, or the base theme with no color scheme. */
  function useCondition(): NativeCondition {
    return useContext(ConditionContext) ?? { theme: holder.baseTheme, colorScheme: undefined }
  }

  return { ThemeContext, ThemeValueProvider, useTheme, useCondition }
}
