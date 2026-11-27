'use client'

import { createContext, useContext, useMemo, type Context, type ReactNode } from 'react'
import { type ColorScheme, type ThemeInput } from '@umber-style/core'
import { EMPTY_THEME, mergeTheme, resolveThemeInput } from '@umber-style/core/internal'
import { readSchemeName, type NativeCondition } from './conditions'
import { guardTheme } from './devGuard'
import type { NativeTheme } from './nativeTheme'

/** The props of the provider that `createThemeValue` makes, which `ThemeProvider` renders. */
export interface ThemeValueProviderProps<T> {
  /** The theme of this subtree, or a function of the theme above: merged over the theme above. */
  readonly theme: ThemeInput<T>
  /** The color scheme of this subtree, for `whenScheme`; `light dark` and nothing keep the one above. */
  readonly colorScheme?: ColorScheme
  /** The subtree that the theme applies to. */
  readonly children?: ReactNode
}

/** Where the base theme lives while no provider is above: given by the app (`createStyle(theme)`, `configure({ theme })`), never by a provider. */
export interface ThemeHolder<T> {
  baseTheme: T | undefined
}

/**
 * The contexts of the engine: the real theme values (`ThemeContext`, made here unless given; the base
 * theme of `holder`, else an empty object, where there is no provider), and what a condition is matched
 * against. A theme is held as React Native takes it: `convert` makes that of each theme object once, and
 * the result is remembered for that object. A provider merges, and a function theme receives, the theme
 * as it was given, not the converted one, so that one source does the same on both platforms.
 */
export function createThemeValue<T extends object>(
  holder: ThemeHolder<T>,
  convert: (theme: T) => NativeTheme<T>,
  ThemeContext: Context<NativeTheme<T> | undefined> = createContext<NativeTheme<T> | undefined>(
    undefined
  )
) {
  const ConditionContext = createContext<NativeCondition | undefined>(undefined)
  const nativeByTheme = new WeakMap<object, NativeTheme<T>>()
  const themeByNative = new WeakMap<object, T>()

  /** `theme` converted, once for each theme object. */
  const toNative = (theme: T): NativeTheme<T> => {
    let native = nativeByTheme.get(theme)
    if (native === undefined) {
      native = convert(theme)
      nativeByTheme.set(theme, native)
      themeByNative.set(native, theme)
    }
    return native
  }

  /** The theme where no provider is above: the base theme given by the app, or the empty theme. */
  const readOwnTheme = () => holder.baseTheme ?? (EMPTY_THEME as T)

  function ThemeValueProvider({ theme, colorScheme, children }: ThemeValueProviderProps<T>) {
    const above = useContext(ThemeContext)
    // The theme above as it was given; a value that an app put in the context itself is taken as it is.
    const outer =
      above === undefined ? holder.baseTheme : (themeByNative.get(above) ?? (above as T))
    const outerScheme = useContext(ConditionContext)?.colorScheme
    const given = useMemo(
      () => resolveThemeInput(theme, outer ?? (EMPTY_THEME as T), guardTheme),
      [theme, outer]
    )
    const value = useMemo(() => toNative(mergeTheme(outer, given)), [outer, given])
    const scheme = readSchemeName(colorScheme) ?? outerScheme
    const condition = useMemo(() => ({ theme: given, colorScheme: scheme }), [given, scheme])
    return (
      <ThemeContext.Provider value={value}>
        <ConditionContext.Provider value={condition}>{children}</ConditionContext.Provider>
      </ThemeContext.Provider>
    )
  }

  /** The theme of the nearest provider, the base theme, or an empty object, converted. */
  function useTheme(): NativeTheme<T> {
    return useContext(ThemeContext) ?? toNative(readOwnTheme())
  }

  /** What `when()` and `whenScheme()` keys are matched against: the nearest provider, or the base theme with no color scheme. */
  function useCondition(): NativeCondition {
    return useContext(ConditionContext) ?? { theme: holder.baseTheme, colorScheme: undefined }
  }

  return { ThemeContext, ThemeValueProvider, useTheme, useCondition }
}
