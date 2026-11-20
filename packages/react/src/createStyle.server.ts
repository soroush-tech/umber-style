import {
  createCssEntry,
  createEngine,
  EMPTY_THEME,
  mergeDeep,
  type ColorScheme,
  type DeepPartial,
  type Engine,
  globalStyles,
  isThemedSheet,
  type ObjectSheet,
  type SheetEntries,
  type SheetEntry,
  type SheetStyles,
  type WebStyleObject,
} from '@umber-style/core'
import { createGlobal } from './Global.server'
import { createServerOnlyContext, readServerContext, type CacheFunction } from './serverContext'
import { createStyled } from './styled.server'
import { createThemeProvider } from './ThemeProvider.server'
import type { ServerStyle, SheetDefinition, StyleOptions } from './types'

export type { StyleOptions } from './types'

/** A sheet on the server: it makes its class names on first use. */
interface ServerSheet<S extends SheetStyles> extends SheetDefinition<S, SheetEntry> {
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

/** Makes the styling for server components over an engine; `cache` makes the slot of a request, `React.cache` unless a test gives one. */
export function bindEngine<T extends object>(
  engine: Engine<T>,
  cache?: CacheFunction
): ServerStyle<T> {
  const root = createServerOnlyContext<DeepPartial<T> | undefined>(undefined, cache)
  // Whether the stamp of the cache options was sent in this request.
  const stamp = createServerOnlyContext<boolean>(false, cache)

  // The root theme over the base theme, made once for each root.
  const merged = new WeakMap<object, T>()

  /** `rootTheme` over the base theme. A provider gives the engine its base theme before it gives the root, so the base exists here. */
  const mergeRoot = (rootTheme: DeepPartial<T>): T => {
    const base = engine.baseTheme as T
    if ((rootTheme as unknown) === base) return base
    let theme = merged.get(rootTheme)
    if (theme === undefined) {
      theme = mergeDeep<T>(base, rootTheme)
      merged.set(rootTheme, theme)
    }
    return theme
  }

  /** The root theme of the request, or the base theme of the engine, or an empty object when there is neither. */
  const readTheme = (): T => {
    const rootTheme = readServerContext(root)
    if (rootTheme === undefined) return engine.baseTheme ?? (EMPTY_THEME as T)
    return mergeRoot(rootTheme)
  }

  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    engine.themeClass(partial, colorScheme)

  // An object sheet is its own entries: it reads no theme, so it works with none.
  const useStyle = ((sheet: object) =>
    isThemedSheet(sheet)
      ? sheet.resolve(engine.createThemeView(readTheme()))
      : sheet) as ServerStyle<T>['useStyle']

  function create<K extends string>(styles: ObjectSheet<K>): SheetEntries<K>
  function create<K extends string>(
    styles: (theme: T) => Record<K, WebStyleObject>
  ): ServerSheet<Record<K, WebStyleObject>>
  function create(
    styles: ObjectSheet<string> | ((theme: T) => Record<string, WebStyleObject>)
  ): unknown {
    return engine.createSheet(styles as never)
  }

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, readTheme),
    StyleSheet: { create },
    useStyle,
    apply: (...entries) => ({ className: engine.css(...entries) || undefined }),
    css: ((...args: unknown[]) => createCssEntry(engine.cache, args)) as ServerStyle<T>['css'],
    ThemeProvider: createThemeProvider(engine, { root, stamp, readTheme, mergeRoot }),
    readTheme,
    themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
    keyframes: engine.keyframes,
    globalStyles,
    Global: createGlobal(engine, readTheme),
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
