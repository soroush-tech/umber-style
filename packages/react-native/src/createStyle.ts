import { createElement, Fragment, type Context, type ReactElement } from 'react'
import { createNativeThemeKey, type NativeCondition } from './conditions'
import {
  createLazyRecord,
  createSchemeKey,
  globalStyles,
  isThemedSheet,
  keyframes,
  readStaticTemplate,
  rejectFunctions,
} from '@umber-style/core'
import { createThemeValue } from './ThemeValue'
import type {
  GlobalProps,
  NativeStyle,
  SheetDefinition,
  StyleOptions,
  ThemeProviderProps,
  ThemeScopeProps,
} from './types'
import type { NativeObjectSheet, NativeSheetStyles, NativeStyleObject } from './nativeStyle'
import { DEFAULT_LENGTH_KEYS, toNativeTheme, type NativeTheme } from './nativeTheme'
import { createStyled } from './styled'
import { platformStyleSheet } from './platform'
import { hasConditions, toNativeStyle } from './toNativeStyle'
import { DEFAULT_REM_BASE } from './units'

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

/** The name of the sheet entry `key` in the development warnings. */
const toEntryName = (key: string) => `sheet entry "${key}"`

/** Registers `source` with the platform StyleSheet, without the keys that only the web has; a `rem` length is `remBase` times its number. */
function register<S extends NativeSheetStyles>(source: S, remBase: number): RegisteredSheet<S> {
  const pairs = Object.entries(source).map(([key, style]) => [
    key,
    toNativeStyle(style, undefined, { remBase, name: toEntryName(key) }),
  ])
  const entries = platformStyleSheet.create(Object.fromEntries(pairs)) as {
    [K in keyof S]: NativeStyleObject
  }
  return { entries, source, isConditional: Object.values(source).some(hasConditions) }
}

/** The entries of `sheet`, with the ones that have a `when()` or `whenScheme()` key resolved against `condition` (not registered: they change with the providers). */
function resolveEntries<S extends NativeSheetStyles>(
  sheet: RegisteredSheet<S>,
  condition: NativeCondition | undefined,
  remBase: number
): { [K in keyof S]: NativeStyleObject } {
  if (!sheet.isConditional) return sheet.entries
  const pairs = Object.entries(sheet.source).map(([key, style]) => [
    key,
    hasConditions(style)
      ? toNativeStyle(style, condition, { remBase, name: toEntryName(key) })
      : sheet.entries[key],
  ])
  return Object.fromEntries(pairs) as { [K in keyof S]: NativeStyleObject }
}

/**
 * `css()` on React Native: the styles (lists flattened, falsy values dropped), or the style of a tagged
 * template read as CSS text, each turned into a native style as a sheet entry is, merged in order with
 * the last key winning. Throws a `TypeError` for a function and for anything else that is not a style.
 */
function mergeNativeStyles(args: readonly unknown[], remBase: number): NativeStyleObject {
  const template = readStaticTemplate(args, 'css')
  if (!template) rejectFunctions(args, 'css')
  const styles = template ? [template] : args.flat(Infinity).filter(Boolean)
  // The development warnings name `css()`.
  const settings = { remBase, name: 'css()' }
  const merged: NativeStyleObject = {}
  for (const style of styles) {
    if (typeof style !== 'object') {
      throw new TypeError(`css(): ${JSON.stringify(style)} is not a style: give style objects.`)
    }
    Object.assign(merged, toNativeStyle(style as Record<string, unknown>, undefined, settings))
  }
  return merged
}

/** `Global` on React Native: there are no global styles, so it renders nothing and does nothing. */
function Global<T>(_props: GlobalProps<T>): null {
  return null
}

/** `ThemeScope` on React Native: there is no wrapper to repeat, and a modal stays inside the tree, so it renders its children. */
function ThemeScope({ children }: ThemeScopeProps): ReactElement {
  return createElement(Fragment, null, children)
}

/** `useThemeClass` on React Native: there are no classes. */
function useThemeClass(): string | undefined {
  return undefined
}

/** Where the base theme lives: set by the outermost provider, or by the app. */
export interface NativeHolder<T> {
  baseTheme: T | undefined
}

/**
 * Makes the React Native styling over a holder of the base theme; the theme context is made here unless
 * given. Of `options`, `remBase` and `lengthKeys` are used: a theme is converted under `lengthKeys`.
 */
export function bindHolder<T extends object>(
  holder: NativeHolder<T>,
  context?: Context<NativeTheme<T> | undefined>,
  options: StyleOptions<T> = {}
): NativeStyle<T> {
  const { remBase = DEFAULT_REM_BASE, lengthKeys = DEFAULT_LENGTH_KEYS } = options
  const { ThemeContext, ThemeValueProvider, useTheme, useCondition } = createThemeValue(
    holder,
    (theme: T) => toNativeTheme(theme, lengthKeys, remBase),
    context
  )

  function ThemeProvider({ theme, colorScheme, children }: ThemeProviderProps<T>): ReactElement {
    return createElement(ThemeValueProvider, { theme, colorScheme }, children)
  }

  function create<K extends string>(
    styles: NativeObjectSheet<K>
  ): { readonly [P in K]: NativeStyleObject }
  function create<K extends string>(
    styles: (theme: NativeTheme<T>) => Record<K, NativeStyleObject>
  ): NativeSheet<Record<K, NativeStyleObject>, NativeTheme<T>>
  function create(
    styles:
      | NativeObjectSheet<string>
      | ((theme: NativeTheme<T>) => Record<string, NativeStyleObject>)
  ): unknown {
    if (typeof styles !== 'function') {
      // Registered with the platform when the first key is read, once. There is no theme and no condition.
      let registered: RegisteredSheet<NativeSheetStyles> | undefined
      return createLazyRecord(Object.keys(styles), (key) => {
        registered ??= register(styles as NativeSheetStyles, remBase)
        return registered.entries[key]
      })
    }
    const byTheme = new WeakMap<object, RegisteredSheet<Record<string, NativeStyleObject>>>()
    return {
      resolve(current: NativeTheme<T>, condition?: NativeCondition) {
        let sheet = byTheme.get(current)
        if (!sheet) {
          sheet = register(styles(current), remBase)
          byTheme.set(current, sheet)
        }
        return resolveEntries(sheet, condition, remBase)
      },
    }
  }

  // The contexts are read first, for every sheet, so that the hooks of a component never change; an
  // object sheet is its own registered styles and uses no theme.
  const useStyle = ((sheet: object) => {
    const theme = useTheme()
    const condition = useCondition()
    if (!isThemedSheet(sheet)) return sheet
    return (sheet as NativeSheet<NativeSheetStyles, NativeTheme<T>>).resolve(theme, condition)
  }) as NativeStyle<T>['useStyle']

  return {
    styled: createStyled(useTheme, useCondition, remBase),
    StyleSheet: { ...platformStyleSheet, create },
    useStyle,
    apply: (...entries) => ({ style: entries.filter((entry) => !!entry) as NativeStyleObject[] }),
    css: ((...args: unknown[]) => mergeNativeStyles(args, remBase)) as NativeStyle<T>['css'],
    ThemeProvider,
    ThemeScope,
    ThemeContext,
    useTheme,
    useThemeClass,
    themeClass: () => '',
    when: createNativeThemeKey,
    whenScheme: createSchemeKey,
    keyframes,
    globalStyles,
    Global,
  }
}

/**
 * Makes the styling of one theme shape for React Native, apart from the default one. The options are
 * those of the web, so that one call runs on both platforms, with `remBase` added; of them only
 * `remBase` and `lengthKeys` are used.
 */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): NativeStyle<T> {
  return bindHolder({ baseTheme: theme }, undefined, options)
}
