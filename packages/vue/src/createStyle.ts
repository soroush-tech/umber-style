import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import {
  createEngine,
  type Engine,
  NO_THEME_MESSAGE,
  type SheetInput,
  type WebStyleObject,
} from '@umber-style/core'
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

  const create = <K extends string>(styles: SheetInput<K, T>): Sheet<Record<K, WebStyleObject>> =>
    engine.createSheet(styles)

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, useThemeView),
    StyleSheet: { create },
    useStyle: (sheet) => sheet.resolve(sheet.isDynamic ? useThemeView() : undefined),
    apply: (...entries) => ({ class: engine.css(...entries) || undefined }),
    ThemeProvider: createThemeProvider(engine, key),
    useTheme,
    themeClass: engine.themeClass,
  }
}

/** Makes the Vue styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(theme: T, options: StyleOptions<T> = {}): Style<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine)
}
