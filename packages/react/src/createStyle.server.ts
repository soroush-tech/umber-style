import {
  createEngine,
  mergeDeep,
  NO_THEME_MESSAGE,
  type ColorScheme,
  type DeepPartial,
  type Engine,
  type SheetEntry,
  type SheetInput,
  type SheetStyles,
  type WebStyleObject,
} from '@umber-style/core'
import { createServerOnlyContext, readServerContext, type CacheFunction } from './serverContext'
import { createStyled } from './styled.server'
import { createThemeProvider } from './ThemeProvider.server'
import type { ServerStyle, SheetDefinition, StyleOptions } from './types'

export type { StyleOptions } from './types'

/** A sheet on the server: it makes its class names on first use. */
interface ServerSheet<S extends SheetStyles> extends SheetDefinition<S, SheetEntry> {
  isDynamic: boolean
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

/** Makes the styling for server components over an engine; `cache` makes the slot of a request, `React.cache` unless a test gives one. */
export function bindEngine<T extends object>(
  engine: Engine<T>,
  cache?: CacheFunction
): ServerStyle<T> {
  const root = createServerOnlyContext<DeepPartial<T> | undefined>(undefined, cache)

  // The root theme over the base theme, made once for each root.
  const merged = new WeakMap<object, T>()

  /** The root theme of the request, or the base theme of the engine; throws when there is neither. */
  const readTheme = (): T => {
    const rootTheme = readServerContext(root)
    const base = engine.baseTheme
    if (rootTheme === undefined) {
      if (base === undefined) throw new Error(NO_THEME_MESSAGE)
      return base
    }
    // A provider gives the engine its base theme before it gives the root, so the base exists here.
    if ((rootTheme as unknown) === base) return rootTheme as T
    let theme = merged.get(rootTheme)
    if (theme === undefined) {
      theme = mergeDeep<T>(base as T, rootTheme)
      merged.set(rootTheme, theme)
    }
    return theme
  }

  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    engine.themeClass(partial, colorScheme)

  const useStyle = <S extends SheetStyles>(sheet: SheetDefinition<S, SheetEntry>) => {
    const { isDynamic, resolve } = sheet as ServerSheet<S>
    return resolve(isDynamic ? engine.createThemeView(readTheme()) : undefined)
  }

  const create = <K extends string>(
    styles: SheetInput<K, T>
  ): ServerSheet<Record<K, WebStyleObject>> => engine.createSheet(styles)

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, readTheme),
    StyleSheet: { create },
    useStyle,
    apply: (...entries) => ({ className: engine.css(...entries) || undefined }),
    ThemeProvider: createThemeProvider(engine, root),
    readTheme,
    themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
  }
}

/** Makes the styling for server components of one theme shape: its own engine, or the one given. */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): ServerStyle<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine)
}
