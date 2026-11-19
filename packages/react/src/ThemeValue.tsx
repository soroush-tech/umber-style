'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { type DeepPartial, mergeDeep, NO_THEME_MESSAGE } from '@umber-style/core'

export interface ThemeValueProviderProps<T> {
  theme: DeepPartial<T>
  children?: ReactNode
}

/** Where the base theme comes from while no provider is above: an engine, or any object with a `baseTheme`. */
export interface ThemeHolder<T> {
  readonly baseTheme: T | undefined
}

/** The one React context of the engine: it holds the real theme values, and the base theme of `holder` is its default. */
export function createThemeValue<T extends object>(holder: ThemeHolder<T>) {
  const ThemeContext = createContext<T | undefined>(undefined)

  function ThemeValueProvider({ theme, children }: ThemeValueProviderProps<T>) {
    const outer = useContext(ThemeContext) ?? holder.baseTheme
    const value = useMemo(
      () => (outer === undefined ? (theme as T) : mergeDeep(outer, theme)),
      [outer, theme]
    )
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  }

  /** The theme above, or the base theme, or undefined when there is none. */
  function useThemeValue(): T | undefined {
    return useContext(ThemeContext) ?? holder.baseTheme
  }

  function useTheme(): T {
    const value = useThemeValue()
    if (value === undefined) throw new Error(NO_THEME_MESSAGE)
    return value
  }

  return { ThemeValueProvider, useTheme, useThemeValue }
}
