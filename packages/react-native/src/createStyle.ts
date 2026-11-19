import { createElement, type ReactElement } from 'react'
import { createNativeThemeKey, type NativeCondition } from './conditions'
import {
  createLazyRecord,
  createSchemeKey,
  isThemedSheet,
  NO_THEME_MESSAGE,
} from '@umber-style/core'
import { createThemeValue } from './ThemeValue'
import type { NativeStyle, SheetDefinition, StyleOptions, ThemeProviderProps } from './types'
import type { NativeObjectSheet, NativeSheetStyles, NativeStyleObject } from './nativeStyle'
import { createStyled } from './styled'
import { platformStyleSheet } from './platform'
import { hasConditions, toNativeStyle } from './toNativeStyle'

export type { StyleOptions } from './types'

/** A sheet made from a function on React Native: its styles are registered with the platform once for each theme. */
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
  const { ThemeValueProvider, useTheme, useThemeValue, useCondition } = createThemeValue(holder)

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
    styles: NativeObjectSheet<K>
  ): { readonly [P in K]: NativeStyleObject }
  function create<K extends string>(
    styles: (theme: T) => Record<K, NativeStyleObject>
  ): NativeSheet<Record<K, NativeStyleObject>, T>
  function create(
    styles: NativeObjectSheet<string> | ((theme: T) => Record<string, NativeStyleObject>)
  ): unknown {
    if (typeof styles !== 'function') {
      // Registered with the platform when the first key is read, once. There is no theme and no condition.
      let registered: RegisteredSheet<NativeSheetStyles> | undefined
      return createLazyRecord(Object.keys(styles), (key) => {
        registered ??= register(styles as NativeSheetStyles)
        return registered.entries[key]
      })
    }
    const byTheme = new WeakMap<object, RegisteredSheet<Record<string, NativeStyleObject>>>()
    return {
      resolve(current: T, condition?: NativeCondition) {
        let sheet = byTheme.get(current)
        if (!sheet) {
          sheet = register(styles(current))
          byTheme.set(current, sheet)
        }
        return resolveEntries(sheet, condition)
      },
    }
  }

  // The contexts are read first, for every sheet, so that the hooks of a component never change; an
  // object sheet is its own registered styles and uses no theme.
  const useStyle = ((sheet: object) => {
    const theme = useThemeValue()
    const condition = useCondition()
    if (!isThemedSheet(sheet)) return sheet
    if (theme === undefined) throw new Error(NO_THEME_MESSAGE)
    return (sheet as NativeSheet<NativeSheetStyles, T>).resolve(theme, condition)
  }) as NativeStyle<T>['useStyle']

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
