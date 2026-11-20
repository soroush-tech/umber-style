import {
  type Cache,
  type ColorScheme,
  createCssEntry,
  createEngine,
  type DeepPartial,
  type Engine,
  findEntryCache,
  globalStyles,
  isThemedSheet,
  type ObjectSheet,
  type SheetEntries,
  type SheetEntry,
  type SheetStyles,
  type WebStyleObject,
} from '@umber-style/core'
import { useProvidedCache } from './CacheProvider'
import { createGlobal } from './Global'
import { createGlobalElements, createStampElement, createStyleElements } from './styleElements'
import { createStyled } from './styled'
import { createThemeProvider } from './ThemeProvider'
import { createThemeContexts, createThemeValue, type ThemeContexts } from './ThemeValue'
import type { ServerStyleOptions, SheetDefinition, StyleOptions, WebStyle } from './types'

export type { StyleOptions } from './types'

/** A sheet on the web: it makes its class names on first use. */
interface WebSheet<S extends SheetStyles> extends SheetDefinition<S, SheetEntry> {
  resolve(theme?: unknown): { [K in keyof S]: SheetEntry }
}

/** Makes the React styling over an engine: `styled`, sheets, the theme provider and `useTheme`; `contexts` are made here unless given. */
export function bindEngine<T extends object>(
  engine: Engine<T>,
  { hasServerStyleElements = true }: ServerStyleOptions = {},
  contexts: ThemeContexts<T> = createThemeContexts<T>()
): WebStyle<T> {
  const { useTheme, useThemeView, useThemeClass, ThemeScope } = createThemeValue(engine, contexts)

  // Where there is no document (a server render), the style of a class is sent as style elements; not
  // under a cache provider (`cache`), whose rules the app sends itself.
  const hasStyleElements = () => hasServerStyleElements && typeof document === 'undefined'
  const renderStyleElements = (className: string, cache?: Cache) =>
    cache === undefined && hasStyleElements() ? createStyleElements(engine.cache, className) : []

  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    engine.themeClass(partial, colorScheme)

  // The context is read first, for every sheet, so that the hooks of a component never change; an object
  // sheet is its own entries and uses no theme. Under a cache provider the entries are those of the
  // engine over its cache, for the same styles, so that what uses them writes there.
  const useStyle = ((sheet: object) => {
    const cache = useProvidedCache()
    const view = useThemeView(cache)
    const entries = (isThemedSheet(sheet) ? sheet.resolve(view) : sheet) as SheetEntries<string>
    return cache === undefined ? entries : engine.withCache(cache).adoptSheet(entries)
  }) as WebStyle<T>['useStyle']

  function create<K extends string>(styles: ObjectSheet<K>): SheetEntries<K>
  function create<K extends string>(
    styles: (theme: T) => Record<K, WebStyleObject>
  ): WebSheet<Record<K, WebStyleObject>>
  function create(
    styles: ObjectSheet<string> | ((theme: T) => Record<string, WebStyleObject>)
  ): unknown {
    return engine.createSheet(styles as never)
  }

  return {
    engine,
    cache: engine.cache,
    styled: createStyled(engine, useThemeView, renderStyleElements),
    StyleSheet: { create },
    useStyle,
    // The class is made in the cache of the entries: under a cache provider, the entries of `useStyle`
    // are that cache's.
    apply: (...entries) => ({
      className: (findEntryCache(entries) ?? engine.cache).css(...entries) || undefined,
    }),
    css: ((...args: unknown[]) => createCssEntry(engine.cache, args)) as WebStyle<T>['css'],
    ThemeProvider: createThemeProvider({
      engine,
      contexts,
      getServerStyle: () =>
        hasStyleElements()
          ? {
              createStyleElements: renderStyleElements,
              createStamp: () => createStampElement(engine.cache),
            }
          : undefined,
    }),
    ThemeScope,
    ThemeContext: contexts.ThemeContext,
    useTheme,
    useThemeClass,
    themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
    keyframes: engine.keyframes,
    globalStyles,
    Global: createGlobal(engine, useThemeView, (sets) =>
      hasStyleElements() ? createGlobalElements(engine.cache, sets) : []
    ),
  }
}

/** Makes the React styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): WebStyle<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (!engine.hasTheme) engine.setTheme(theme)
  return bindEngine(engine, options)
}
