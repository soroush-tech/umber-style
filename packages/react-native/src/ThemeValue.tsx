'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { type ColorScheme, type DeepPartial, mergeDeep, NO_THEME_MESSAGE } from '@umber-style/core'
import { readSchemeName, type NativeCondition } from './conditions'

export interface ThemeValueProviderProps<T> {
  readonly theme: DeepPartial<T>
  /** The color scheme of this subtree, for `whenScheme`; `light dark` and nothing keep the one above. */
  readonly colorScheme?: ColorScheme
  readonly children?: ReactNode
}

/** Where the base theme comes from while no provider is above: an engine, or any object with a `baseTheme`. */
export interface ThemeHolder<T> {
  readonly baseTheme: T | undefined
}

/** The contexts of the engine: the real theme values (the base theme of `holder` is the default), and what a condition is matched against. */
export function createThemeValue<T extends object>(holder: ThemeHolder<T>) {
  const ThemeContext = createContext<T | undefined>(undefined)
  const ConditionContext = createContext<NativeCondition | undefined>(undefined)

  function ThemeValueProvider({ theme, colorScheme, children }: ThemeValueProviderProps<T>) {
    const outer = useContext(ThemeContext) ?? holder.baseTheme
    const outerScheme = useContext(ConditionContext)?.colorScheme
    const value = useMemo(
      () => (outer === undefined ? (theme as T) : mergeDeep(outer, theme)),
      [outer, theme]
    )
    const scheme = readSchemeName(colorScheme) ?? outerScheme
    const condition = useMemo(() => ({ theme, colorScheme: scheme }), [theme, scheme])
    return (
      <ThemeContext.Provider value={value}>
        <ConditionContext.Provider value={condition}>{children}</ConditionContext.Provider>
      </ThemeContext.Provider>
    )
  }

  function useTheme(): T {
    const value = useContext(ThemeContext) ?? holder.baseTheme
    if (value === undefined) throw new Error(NO_THEME_MESSAGE)
    return value
  }

  /** What `when()` and `whenScheme()` keys are matched against: the nearest provider, or the base theme with no color scheme. */
  function useCondition(): NativeCondition {
    return useContext(ConditionContext) ?? { theme: holder.baseTheme, colorScheme: undefined }
  }

  return { ThemeValueProvider, useTheme, useCondition }
}
