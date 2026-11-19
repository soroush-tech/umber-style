import { createElement, type ReactElement } from 'react'
import { createNativeThemeKey, type NativeCondition } from './conditions'
import { createSchemeKey } from '@umber-style/core'
import { createThemeValue } from './ThemeValue'
import type { NativeStyle, SheetDefinition, StyleOptions, ThemeProviderProps } from './types'
import type { NativeSheetInput, NativeSheetStyles, NativeStyleObject } from './nativeStyle'
import { createStyled } from './styled'
import { platformStyleSheet } from './platform'
import { hasConditions, toNativeStyle } from './toNativeStyle'

export type { StyleOptions } from './types'

/** A sheet on React Native: its styles are registered with the platform once for each theme (once in all, for objects). */
interface NativeSheet<S extends NativeSheetStyles, T> extends SheetDefinition<
  S,
  NativeStyleObject
> {
  resolve(theme: T, condition?: NativeCondition): { [K in keyof S]: NativeStyleObject }
}

/** The entries of a sheet as registered with the platform, and its sources, for the entries that depend on a condition. */
interface RegisteredSheet<S extends NativeSheetStyles> {
  entries: { [K in keyof S]: NativeStyleObject }
  source: S
  /** Whether an entry has a condition key, so that the entries depend on the providers. */
  isConditional: boolean
}

/** Registers `source` with the platform StyleSheet, without the keys that only the web has. */
function register<S extends NativeSheetStyles>(source: S): RegisteredSheet<S> {
  const pairs = Object.entries(source).map(([key, style]) => [key, toNativeStyle(style)])
  const entries = platformStyleSheet.create(Object.fromEntries(pairs)) as {
    [K in keyof S]: NativeStyleObject
  }
  return { entries, source, isConditional: Object.values(source).some(hasConditions) }
}

/** The entries of `sheet`, with the ones that have a `when()` or `whenScheme()` key resolved against `condition` (not registered: they change with the providers). */
function resolveEntries<S extends NativeSheetStyles>(
  sheet: RegisteredSheet<S>,
  condition: NativeCondition | undefined
): { [K in keyof S]: NativeStyleObject } {
  if (!sheet.isConditional) return sheet.entries
  const pairs = Object.entries(sheet.source).map(([key, style]) => [
    key,
    hasConditions(style) ? toNativeStyle(style, condition) : sheet.entries[key],
  ])
  return Object.fromEntries(pairs) as { [K in keyof S]: NativeStyleObject }
}

/** Where the base theme lives: set by the outermost provider, or by the app. */
export interface NativeHolder<T> {
  baseTheme: T | undefined
}

/** Makes the React Native styling over a holder of the base theme. */
export function bindHolder<T extends object>(holder: NativeHolder<T>): NativeStyle<T> {
  const { ThemeValueProvider, useTheme, useCondition } = createThemeValue(holder)

  function ThemeProvider({
    theme: partial,
    colorScheme,
    children,
  }: ThemeProviderProps<T>): ReactElement {
    // The outermost provider that renders gives the base theme, as on the web.
    holder.baseTheme ??= partial as T
    return createElement(ThemeValueProvider, { theme: partial, colorScheme }, children)
  }

  function create<K extends string>(
    styles: NativeSheetInput<K, T>
  ): NativeSheet<Record<K, NativeStyleObject>, T> {
    type S = Record<K, NativeStyleObject>
    const byTheme = new WeakMap<object, RegisteredSheet<S>>()
    let fixed: RegisteredSheet<S> | undefined
    return {
      resolve(current, condition) {
        if (typeof styles !== 'function') {
          fixed ??= register(styles)
          return resolveEntries(fixed, condition)
        }
        let sheet = byTheme.get(current)
        if (!sheet) {
          sheet = register(styles(current))
          byTheme.set(current, sheet)
        }
        return resolveEntries(sheet, condition)
      },
    }
  }

  function useStyle<S extends NativeSheetStyles>(sheet: SheetDefinition<S, NativeStyleObject>) {
    return (sheet as NativeSheet<S, T>).resolve(useTheme(), useCondition())
  }

  return {
    styled: createStyled(useTheme, useCondition),
    StyleSheet: { ...platformStyleSheet, create },
    useStyle,
    apply: (...entries) => ({ style: entries.filter((entry) => !!entry) as NativeStyleObject[] }),
    ThemeProvider,
    useTheme,
    themeClass: () => '',
    when: createNativeThemeKey,
    whenScheme: createSchemeKey,
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
