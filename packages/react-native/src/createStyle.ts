import { createElement, type ReactElement } from 'react'
import { createThemeValue } from './ThemeValue'
import type { NativeStyle, SheetDefinition, StyleOptions, ThemeProviderProps } from './types'
import type { SheetStyles, StyleObject } from '@umber-style/core'
import { createStyled } from './styled'
import { platformStyleSheet } from './platform'
import { toNativeStyle } from './toNativeStyle'

export type { StyleOptions } from './types'

/** A sheet on React Native: its styles are registered with the platform once for each theme (once in all, for objects). */
interface NativeSheet<S extends SheetStyles, T> extends SheetDefinition<S, StyleObject> {
  resolve(theme: T): { [K in keyof S]: StyleObject }
}

/** Registers `source` with the platform StyleSheet, without the keys that only the web has. */
function register<S extends SheetStyles>(source: S): { [K in keyof S]: StyleObject } {
  const pairs = Object.entries(source).map(([key, style]) => [key, toNativeStyle(style)])
  return platformStyleSheet.create(Object.fromEntries(pairs)) as { [K in keyof S]: StyleObject }
}

/** Where the base theme lives: set by the outermost provider, or by the app. */
export interface NativeHolder<T> {
  baseTheme: T | undefined
}

/** Makes the React Native styling over a holder of the base theme. */
export function bindHolder<T extends object>(holder: NativeHolder<T>): NativeStyle<T> {
  const { ThemeValueProvider, useTheme } = createThemeValue(holder)

  function ThemeProvider({ theme: partial, children }: ThemeProviderProps<T>): ReactElement {
    // The outermost provider that renders gives the base theme, as on the web.
    holder.baseTheme ??= partial as T
    return createElement(ThemeValueProvider, { theme: partial }, children)
  }

  function create<S extends SheetStyles>(styles: S | ((theme: T) => S)): NativeSheet<S, T> {
    const byTheme = new WeakMap<object, { [K in keyof S]: StyleObject }>()
    let fixed: { [K in keyof S]: StyleObject } | undefined
    return {
      resolve(current) {
        if (typeof styles !== 'function') {
          fixed ??= register(styles)
          return fixed
        }
        let entries = byTheme.get(current)
        if (!entries) {
          entries = register(styles(current))
          byTheme.set(current, entries)
        }
        return entries
      },
    }
  }

  function useStyle<S extends SheetStyles>(sheet: SheetDefinition<S, StyleObject>) {
    return (sheet as NativeSheet<S, T>).resolve(useTheme())
  }

  return {
    styled: createStyled(useTheme),
    StyleSheet: { ...platformStyleSheet, create },
    useStyle,
    apply: (...entries) => ({ style: entries.filter((entry) => !!entry) as StyleObject[] }),
    ThemeProvider,
    useTheme,
    themeClass: () => '',
  }
}

/** Makes the styling of one theme shape for React Native, apart from the default one; the options are those of the web and are not used. */
export function createStyle<T extends object>(
  theme: T,
  // The options are only here so that the same call runs on both platforms.
  _options: StyleOptions<T> = {}
): NativeStyle<T> {
  return bindHolder({ baseTheme: theme })
}
