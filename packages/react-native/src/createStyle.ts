import { createElement, Fragment, type Context, type ReactElement } from 'react'
import { createNativeThemeKey, type NativeCondition } from './conditions'
import { globalStyles, isThemedSheet, keyframes } from '@umber-style/core'
import {
  createLazyRecord,
  createSchemeKey,
  EMPTY_THEME,
  readStaticTemplate,
  rejectFunctions,
} from '@umber-style/core/internal'
import { guardTheme } from './devGuard'
import { createThemeValue, type ThemeHolder } from './ThemeValue'
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
import { collectKeys, toNativeStyle, type NativeSettings, type StyleKeys } from './toNativeStyle'
import { DEFAULT_REM_BASE } from './units'
import { readMediaKey, readWindowState, useMediaKey } from './windowState'
import { warnAboutIgnoredOptions } from './warnStyle'

export type { StyleOptions } from './types'

/** A sheet made from a function on React Native: its styles are registered with the platform once for each theme. */
interface NativeSheet<S extends NativeSheetStyles, T> extends SheetDefinition<
  S,
  NativeStyleObject
> {
  /** The sheet of `theme`, registered once for each theme object. */
  prepare(theme: T): RegisteredSheet<S>
  /** The entries for `theme`, the providers of `condition` and the window now. */
  resolve(theme: T, condition?: NativeCondition): { [K in keyof S]: NativeStyleObject }
}

/** The entries of a sheet as registered with the platform, and its sources, for the entries that depend on a condition or the window. */
interface RegisteredSheet<S extends NativeSheetStyles> {
  entries: { [K in keyof S]: NativeStyleObject }
  source: S
  /** The condition and media keys of each entry. */
  keys: Record<string, StyleKeys>
  /** Whether an entry has a condition key, so that the entries depend on the providers. */
  isConditional: boolean
  /** The media queries of the entries, each once. */
  queries: readonly string[]
  /** Whether an entry has a `whenScheme()` key. */
  hasScheme: boolean
  /** The entries for each set of matching queries, with the ones that depend on the window only registered for it. */
  byWindow?: Map<string, { [K in keyof S]: NativeStyleObject }>
}

const NO_QUERIES: readonly string[] = []
const NO_KEYS: StyleKeys = { isConditional: false, hasScheme: false, queries: [], states: [] }

/** The name of the sheet entry `key` in the development warnings. */
const toEntryName = (key: string) => `sheet entry "${key}"`

/** What turning a sheet entry into a native style needs: the base of `rem` and the motion of the styling. */
type SheetSettings = Omit<NativeSettings, 'name'>

/** The settings of the sheet entry `key`: `base` with the name the development warnings give it. */
const toEntrySettings = (base: SheetSettings, key: string): NativeSettings => ({
  ...base,
  name: toEntryName(key),
})

/** Registers `source` with the platform StyleSheet, without the keys that only the web has; a `rem` length is `remBase` times its number. */
function register<S extends NativeSheetStyles>(source: S, base: SheetSettings): RegisteredSheet<S> {
  const pairs = Object.entries(source).map(([key, style]) => [
    key,
    toNativeStyle(style, undefined, toEntrySettings(base, key)),
  ])
  const entries = platformStyleSheet.create(Object.fromEntries(pairs)) as {
    [K in keyof S]: NativeStyleObject
  }
  // The keys of all the entries together, then of each one when there are any.
  let all: StyleKeys | undefined
  for (const key in source) all = collectKeys(source[key], all)
  const keys: Record<string, StyleKeys> = {}
  if (all !== undefined) for (const key in source) keys[key] = collectKeys(source[key]) ?? NO_KEYS
  return {
    entries,
    source,
    keys,
    isConditional: all?.isConditional ?? false,
    queries: all?.queries ?? NO_QUERIES,
    hasScheme: all?.hasScheme ?? false,
  }
}

/** The entries of `sheet` for the key of a render, with the ones that depend on the window only resolved and registered once for each set of matching queries. */
function readWindowEntries<S extends NativeSheetStyles>(
  sheet: RegisteredSheet<S>,
  key: string,
  base: SheetSettings
): { [K in keyof S]: NativeStyleObject } {
  const { entries, keys, queries, source } = sheet
  const windowKey = key.slice(0, queries.length)
  const byWindow = (sheet.byWindow ??= new Map())
  let found = byWindow.get(windowKey)
  if (found === undefined) {
    const state = readWindowState()
    const pairs = Object.entries(source).flatMap(([name, style]) =>
      keys[name].queries.length > 0 && !keys[name].isConditional
        ? [[name, toNativeStyle(style, undefined, toEntrySettings(base, name), state)]]
        : []
    )
    found = { ...entries, ...platformStyleSheet.create(Object.fromEntries(pairs)) }
    byWindow.set(windowKey, found)
  }
  return found
}

/**
 * The entries of `sheet` for the key of a render: the ones that depend on the window only as registered
 * for the matching queries, and the ones that have a `when()` or `whenScheme()` key resolved against
 * `condition` and the window (not registered: they change with the providers).
 */
function resolveEntries<S extends NativeSheetStyles>(
  sheet: RegisteredSheet<S>,
  condition: NativeCondition | undefined,
  key: string,
  base: SheetSettings
): { [K in keyof S]: NativeStyleObject } {
  const { isConditional, keys, queries, source } = sheet
  const hasQueries = queries.length > 0
  const entries = hasQueries ? readWindowEntries(sheet, key, base) : sheet.entries
  if (!isConditional) return entries
  const state = hasQueries ? readWindowState() : undefined
  const pairs = Object.entries(source).map(([name, style]) => [
    name,
    keys[name].isConditional
      ? toNativeStyle(style, condition, toEntrySettings(base, name), state)
      : entries[name],
  ])
  return Object.fromEntries(pairs) as { [K in keyof S]: NativeStyleObject }
}

/**
 * `css()` on React Native: the styles (lists flattened, falsy values dropped), or the style of a tagged
 * template read as CSS text, each turned into a native style as a sheet entry is, merged in order with
 * the last key winning. Throws a `TypeError` for a function and for anything else that is not a style.
 */
function mergeNativeStyles(args: readonly unknown[], base: SheetSettings): NativeStyleObject {
  const template = readStaticTemplate(args, 'css')
  if (!template) rejectFunctions(args, 'css')
  const styles = template ? [template] : args.flat(Infinity).filter(Boolean)
  // The development warnings name `css()`.
  const settings = { ...base, name: 'css()' }
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

/**
 * Makes the React Native styling over a holder of the base theme; the theme context is made here unless
 * given. Of `options`, `remBase`, `lengthKeys` and `animated` are used: a theme is converted under
 * `lengthKeys`, and with `animated` the animation and transition keys run (see `Motion`).
 */
export function bindHolder<T extends object>(
  holder: ThemeHolder<T>,
  context?: Context<NativeTheme<T> | undefined>,
  options: StyleOptions<T> = {}
): NativeStyle<T> {
  const { remBase = DEFAULT_REM_BASE, lengthKeys = DEFAULT_LENGTH_KEYS, animated } = options
  warnAboutIgnoredOptions(options)
  // Steps that are a function of the theme are resolved against the base theme as it was given.
  const motion = animated?.bind({ remBase, readTheme: () => holder.baseTheme ?? EMPTY_THEME })
  const base: SheetSettings = { remBase, motion }
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
        registered ??= register(styles as NativeSheetStyles, base)
        return registered.entries[key]
      })
    }
    const byTheme = new WeakMap<object, RegisteredSheet<Record<string, NativeStyleObject>>>()
    const prepare = (current: NativeTheme<T>) => {
      let sheet = byTheme.get(current)
      if (!sheet) {
        sheet = register(styles(guardTheme(current, 'StyleSheet')), base)
        byTheme.set(current, sheet)
      }
      return sheet
    }
    return {
      prepare,
      resolve(current: NativeTheme<T>, condition?: NativeCondition) {
        const sheet = prepare(current)
        return resolveEntries(sheet, condition, readMediaKey(sheet.queries, false, remBase), base)
      },
    }
  }

  // The contexts and the window are read first, for every sheet, so that the hooks of a component never
  // change; an object sheet is its own registered styles, uses no theme and watches nothing.
  const useStyle = ((sheet: object) => {
    const theme = useTheme()
    const condition = useCondition()
    const prepared = isThemedSheet(sheet)
      ? (sheet as unknown as NativeSheet<NativeSheetStyles, NativeTheme<T>>).prepare(theme)
      : undefined
    const shouldWatchScheme = !!prepared?.hasScheme && condition.colorScheme === undefined
    const key = useMediaKey(prepared?.queries ?? NO_QUERIES, shouldWatchScheme, remBase)
    return prepared === undefined ? sheet : resolveEntries(prepared, condition, key, base)
  }) as NativeStyle<T>['useStyle']

  return {
    styled: createStyled(useTheme, useCondition, remBase, motion),
    StyleSheet: { ...platformStyleSheet, create },
    useStyle,
    apply: (...entries) => ({ style: entries.filter((entry) => !!entry) as NativeStyleObject[] }),
    css: ((...args: unknown[]) => mergeNativeStyles(args, base)) as NativeStyle<T>['css'],
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
 * those of the web, so that one call runs on both platforms, with `remBase` and `animated` added; of them
 * only `remBase`, `lengthKeys` and `animated` are used.
 */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): NativeStyle<T> {
  return bindHolder({ baseTheme: theme }, undefined, options)
}
