import { createContext } from 'react'
import {
  createDeferredObject,
  createDeferredRecord,
  globalStyles,
  keyframes,
  type Theme,
} from '@umber-style/core'
import type { NativeStyleObject } from './nativeStyle'
import { bindHolder } from './createStyle'
import type { ThemeHolder } from './ThemeValue'
import type { NativeTheme } from './nativeTheme'
import { platformStyleSheet } from './platform'
import type {
  GlobalProps,
  NativeStyle,
  Styled,
  StyleOptions,
  ThemeProviderProps,
  ThemeScopeProps,
} from './types'
import { DEFAULT_REM_BASE } from './units'
import { useMediaMatch, type MediaQueryOptions } from './windowState'

/** The options of `configure()`: those of `createStyle` for the default style, and its base theme. */
export interface DefaultStyleOptions extends StyleOptions<Theme> {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

/** Makes the default styling: one holder of the base theme, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  const holder: ThemeHolder<Theme> = { baseTheme: undefined }
  let bound: NativeStyle<Theme> | undefined
  let settings: DefaultStyleOptions = {}
  // The context exists before the style is used, so that it can be exported.
  const ThemeContext = createContext<NativeTheme<Theme> | undefined>(undefined)

  const getStyle = (): NativeStyle<Theme> => {
    bound ??= bindHolder(holder, ThemeContext, settings)
    return bound
  }

  /** Gives the default style a base theme and its options (`remBase`, `lengthKeys`, `animated`). Throws once the default style was used. */
  function configure(options: DefaultStyleOptions): void {
    if (bound) throw new Error('configure must be called before the default style is used.')
    holder.baseTheme = options.theme
    settings = options
  }

  const styled = ((tag, options) => getStyle().styled(tag, options)) as Styled<NativeTheme<Theme>>

  // An object sheet is registered on first read, so a module can create one before `configure` is called.
  const StyleSheet: NativeStyle<Theme>['StyleSheet'] = {
    ...platformStyleSheet,
    create: ((styles: Record<string, NativeStyleObject> | ((theme: NativeTheme<Theme>) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as NativeStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as NativeStyle<Theme>['useStyle']

  function useTheme(): NativeTheme<Theme> {
    return getStyle().useTheme()
  }

  function ThemeProvider(props: ThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  function Global(props: GlobalProps<Theme>) {
    return getStyle().Global(props)
  }

  function ThemeScope(props: ThemeScopeProps) {
    return getStyle().ThemeScope(props)
  }

  function useThemeClass(): string | undefined {
    return getStyle().useThemeClass()
  }

  /** Whether the media query `query` matches the window; a `rem` or `em` length in it is the `remBase` of `configure`. */
  function useMediaQuery(query: string, options: MediaQueryOptions = {}): boolean {
    return useMediaMatch(query, options, settings.remBase ?? DEFAULT_REM_BASE)
  }

  return {
    configure,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    ThemeScope,
    useThemeClass,
    useMediaQuery,
    ThemeContext,
    apply: ((...entries) => getStyle().apply(...entries)) as NativeStyle<Theme>['apply'],
    // The style is made on first use, so a module can call it before `configure`.
    css: ((...args: unknown[]) =>
      createDeferredObject(() =>
        (getStyle().css as (...all: unknown[]) => object)(...args)
      )) as NativeStyle<Theme>['css'],
    when: ((theme, colorScheme) =>
      getStyle().when(theme, colorScheme)) as NativeStyle<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as NativeStyle<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as NativeStyle<Theme>['themeClass'],
    keyframes: keyframes as NativeStyle<Theme>['keyframes'],
    globalStyles: globalStyles as NativeStyle<Theme>['globalStyles'],
    Global,
  }
}
