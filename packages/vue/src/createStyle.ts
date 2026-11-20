import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import {
  createEngine,
  type Engine,
  globalStyles,
  isThemedSheet,
  NO_THEME_MESSAGE,
  type ObjectSheet,
  type SheetEntries,
  type WebStyleObject,
} from '@umber-style/core'
import { createGlobal } from './Global'
import { createStyled } from './styled'
import { createThemeProvider } from './ThemeProvider'
import type { Sheet, Style, StyleOptions } from './types'

export type { StyleOptions } from './types'

/** Makes the Vue styling over an engine: `styled`, sheets, the theme provider and `useTheme`. */
export function bindEngine<T extends object>(engine: Engine<T>): Style<T> {
  const key: InjectionKey<ComputedRef<T>> = Symbol('theme')

  const useTheme = (): ComputedRef<T> =>
    inject(key, null) ??
    computed(() => {
      const { baseTheme } = engine
      if (baseTheme === undefined) throw new Error(NO_THEME_MESSAGE)
      return baseTheme
    })

  // The real theme of the nearest provider, as references for tokens and real raw values.
  const useThemeView = () => engine.createThemeView(useTheme().value)

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
    ThemeProvider: createThemeProvider(engine, key),
    useTheme,
    themeClass: engine.themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
    keyframes: engine.keyframes,
    globalStyles,
    Global: createGlobal(engine, key),
  }
}

/** Makes the Vue styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(theme: T, options: StyleOptions<T> = {}): Style<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine)
}
