import {
  type ColorScheme,
  createEngine,
  type DeepPartial,
  type Engine,
  type SheetEntry,
  type SheetInput,
  type SheetStyles,
  type WebStyleObject,
} from '@umber-style/core'
import { createStyled } from './styled'
import { createThemeProvider } from './ThemeProvider'
import { createThemeValue } from './ThemeValue'
import type { SheetDefinition, StyleOptions, WebStyle } from './types'

export type { StyleOptions } from './types'

/** A sheet on the web: it makes its class names on first use. */
interface WebSheet<S extends SheetStyles> extends SheetDefinition<S, SheetEntry> {
  isDynamic: boolean
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

/** Makes the React styling over an engine: `styled`, sheets, the theme provider and `useTheme`. */
export function bindEngine<T extends object>(engine: Engine<T>): WebStyle<T> {
  const { ThemeValueProvider, useTheme, useThemeValue } = createThemeValue(engine)

  // The real theme of the nearest provider, as references for tokens and real raw values.
  const useThemeView = () => engine.createThemeView(useTheme())

  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    engine.themeClass(partial, colorScheme)

  const useStyle = <S extends SheetStyles>(sheet: SheetDefinition<S, SheetEntry>) => {
    const real = useThemeValue()
    const { isDynamic, resolve } = sheet as WebSheet<S>
    return resolve(isDynamic && real !== undefined ? engine.createThemeView(real) : undefined)
  }

  const create = <K extends string>(
    styles: SheetInput<K, T>
  ): WebSheet<Record<K, WebStyleObject>> => engine.createSheet(styles)

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, useThemeView),
    StyleSheet: { create },
    useStyle,
    apply: (...entries) => ({ className: engine.css(...entries) || undefined }),
    ThemeProvider: createThemeProvider({
      themeClass,
      scopeClass: engine.scopeClass,
      ThemeValueProvider,
    }),
    useTheme,
    themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
  }
}

/** Makes the React styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): WebStyle<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine)
}
