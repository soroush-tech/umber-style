import {
  createEngine,
  isDevelopment,
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
import { createCssEntry, EMPTY_THEME } from '@umber-style/core/internal'
import { createGlobal } from './Global.server'
import { createStyleSender } from './inlineStyles.server'
import { createNonceReader, createRequestSlot, type CacheFunction } from './serverContext'
import { createStyled } from './styled.server'
import { createThemeProvider } from './ThemeProvider.server'
import type { ServerStyle, SheetDefinition, StyleOptions } from './types'
import { createServerStyleValue } from './useStyleValue.server'

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
  // The theme of the first provider of the request, and whether one has rendered.
  const readFirstSlot = createRequestSlot<DeepPartial<T> | undefined>(undefined, cache)
  // The nonce of the request's style elements: the cache's, or the answer of the source the app registered.
  const readNonce = createNonceReader(() => engine.cache.nonce, cache)
  // What every component sends its style texts with: hoisted elements, or `NonceStyles` in inline mode.
  const sendStyles = createStyleSender(engine.cache, cache)
  let hasWarned = false

  const readBaseTheme = (): T => engine.givenTheme ?? (EMPTY_THEME as T)

  /**
   * The base theme: the one given to `createStyle(theme)` or `configure({ theme })`, the same in every
   * render of every request, whatever providers render. With none, an empty object, and one warning in
   * development. A server component cannot see the providers above it: what needs the nearest theme's
   * values is a client component, whose `useTheme()` reads them.
   */
  const useTheme = (): T => {
    if (engine.givenTheme === undefined && !hasWarned && isDevelopment()) {
      hasWarned = true
      console.warn(
        `[${engine.cache.prefix}] useTheme() in a server component returns the base theme, and there is none: give the theme to createStyle(theme) or configure({ theme }) to read it in server components. It returns an empty object.`
      )
    }
    return readBaseTheme()
  }

  // The theme whose view function styles read: the given base theme. With none, the theme of the first
  // provider of the request gives the shape (tokens are references either way), else there is none.
  const readViewTheme = (): T =>
    engine.givenTheme ?? (readFirstSlot().current as T | undefined) ?? (EMPTY_THEME as T)

  const themeClass = (partial: DeepPartial<T>, colorScheme?: ColorScheme) =>
    engine.themeClass(partial, colorScheme)

  // An object sheet is its own entries: it reads no theme, so it works with none.
  const useStyle = ((sheet: object) =>
    isThemedSheet(sheet)
      ? sheet.resolve(engine.createThemeView(readViewTheme()))
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
    styled: createStyled(engine, readViewTheme, readNonce, sendStyles),
    StyleSheet: { create },
    useStyle,
    useStyleValue: createServerStyleValue(engine.cache),
    apply: (...entries) => ({ className: engine.css(...entries) || undefined }),
    css: ((...args: unknown[]) => createCssEntry(engine.cache, args)) as ServerStyle<T>['css'],
    // The provider and `Global` return a Promise only while the nonce a registered source gives is not
    // known yet, which a render of server components awaits: they keep the types of the client build.
    ThemeProvider: createThemeProvider(engine, {
      readFirstSlot,
      readBaseTheme,
      readNonce,
      sendStyles,
    }) as ServerStyle<T>['ThemeProvider'],
    useTheme,
    readTheme: useTheme,
    themeClass,
    when: engine.when,
    whenScheme: engine.whenScheme,
    keyframes: engine.keyframes,
    globalStyles,
    Global: createGlobal(engine, readViewTheme, readNonce, sendStyles) as ServerStyle<T>['Global'],
  }
}

/** Makes the styling for server components of one theme shape: its own engine, or the one given. */
export function createStyle<T extends object>(
  theme: T,
  options: StyleOptions<T> = {}
): ServerStyle<T> {
  const engine = options.engine ?? createEngine(theme, options)
  if (engine.givenTheme === undefined) engine.setTheme(theme)
  return bindEngine(engine)
}
