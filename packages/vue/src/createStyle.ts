import { computed, inject, type ComputedRef } from 'vue'
import {
  type Cache,
  createCssEntry,
  createEngine,
  EMPTY_THEME,
  type Engine,
  findEntryCache,
  globalStyles,
  isThemedSheet,
  type ObjectSheet,
  type SheetEntries,
  type WebStyleObject,
} from '@umber-style/core'
import { injectCache } from './CacheProvider'
import { createGlobal } from './Global'
import { createStyled } from './styled'
import { createThemeKeys, createThemeProvider, createThemeScope } from './ThemeProvider'
import type { Sheet, Style, StyleOptions } from './types'
import { createUseStyleValue } from './useStyleValue'

export type { StyleOptions } from './types'

/** Makes the Vue styling over an engine: `styled`, sheets, the theme provider and `useTheme`. */
export function bindEngine<T extends object>(engine: Engine<T>): Style<T> {
  const keys = createThemeKeys<T>()
  const { ThemeScope, useThemeClass } = createThemeScope(keys)
  /** The theme where no provider is above: the base theme given on purpose, or the empty theme; never one that a provider gave the engine. */
  const readOwnTheme = () => engine.givenTheme ?? (EMPTY_THEME as T)

  const useTheme = (): ComputedRef<T> => inject(keys.theme, null) ?? computed(readOwnTheme)

  // The view of the theme of the nearest provider: references for tokens, real raw values. Under a cache
  // provider (`cache`), the view of the engine over its cache, whose references name its variables.
  const useThemeView = (cache?: Cache) => {
    const local = cache === undefined ? engine : engine.withCache(cache)
    if (local === engine) {
      return inject(keys.view, null)?.value ?? engine.createThemeView(readOwnTheme())
    }
    return local.createThemeView(inject(keys.theme, null)?.value ?? readOwnTheme())
  }

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
    // An object sheet is its own entries: it reads no theme. Under a cache provider the entries are those
    // of the engine over its cache, for the same styles, so that what uses them writes there.
    useStyle: ((sheet: object) => {
      const cache = injectCache()
      const entries = (
        isThemedSheet(sheet) ? sheet.resolve(useThemeView(cache)) : sheet
      ) as SheetEntries<string>
      return cache === undefined ? entries : engine.withCache(cache).adoptSheet(entries)
    }) as Style<T>['useStyle'],
    useStyleValue: createUseStyleValue(() => engine.cache),
    // The class is made in the cache of the entries: under a cache provider, those of `useStyle`.
    apply: (...entries) => ({
      class: (findEntryCache(entries) ?? engine.cache).css(...entries) || undefined,
    }),
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
    Global: createGlobal(engine, keys),
  }
}

/** Makes the Vue styling of one theme shape, apart from the default one: its own engine, or the one given. */
export function createStyle<T extends object>(theme: T, options: StyleOptions<T> = {}): Style<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (engine.givenTheme === undefined) engine.setTheme(theme)
  return bindEngine(engine)
}
