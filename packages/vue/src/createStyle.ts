import { computed, inject, type ComputedRef } from 'vue'
import {
  createCssEntry,
  createEngine,
  EMPTY_THEME,
  type Engine,
  globalStyles,
  isThemedSheet,
  type ObjectSheet,
  type SheetEntries,
  type WebStyleObject,
} from '@umber-style/core'
import { createGlobal } from './Global'
import { createStyled } from './styled'
import { createThemeKeys, createThemeProvider, createThemeScope } from './ThemeProvider'
import type { Sheet, Style, StyleOptions } from './types'

export type { StyleOptions } from './types'

/** Makes the Vue styling over an engine: `styled`, sheets, the theme provider and `useTheme`. */
export function bindEngine<T extends object>(engine: Engine<T>): Style<T> {
  const keys = createThemeKeys<T>()
  const { ThemeScope, useThemeClass } = createThemeScope(keys)
  /** The theme where no provider is above: the base theme, or the empty theme. */
  const readOwnTheme = () => engine.baseTheme ?? (EMPTY_THEME as T)

  const useTheme = (): ComputedRef<T> => inject(keys.theme, null) ?? computed(readOwnTheme)

  // The view of the theme of the nearest provider: references for tokens, real raw values.
  const useThemeView = () =>
    inject(keys.view, null)?.value ?? engine.createThemeView(readOwnTheme())

  function create<K extends string>(styles: ObjectSheet<K>): SheetEntries<K>
  function create<K extends string>(
    styles: (theme: T) => Record<K, WebStyleObject>
  ): Sheet<Record<K, WebStyleObject>>
  function create(
    styles: ObjectSheet<string> | ((theme: T) => Record<string, WebStyleObject>)
  ): unknown {
    return engine.createSheet(styles as never)
  }

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, useThemeView),
    StyleSheet: { create },
    // An object sheet is its own entries: it reads no theme.
    useStyle: ((sheet: object) =>
      isThemedSheet(sheet) ? sheet.resolve(useThemeView()) : sheet) as Style<T>['useStyle'],
    apply: (...entries) => ({ class: engine.css(...entries) || undefined }),
    css: ((...args: unknown[]) => createCssEntry(engine.cache, args)) as Style<T>['css'],
    ThemeProvider: createThemeProvider(engine, keys),
    ThemeScope,
    useTheme,
    useThemeClass,
    themeClass: engine.themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
    keyframes: engine.keyframes,
    globalStyles,
    Global: createGlobal(engine, keys.view),
  }
}

/** Makes the Vue styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(theme: T, options: StyleOptions<T> = {}): Style<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine)
}
