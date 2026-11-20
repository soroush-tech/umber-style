import { createContext } from 'react'
import { createDeferredRecord, globalStyles, keyframes, type Theme } from '@umber-style/core'
import type { NativeStyleObject } from './nativeStyle'
import { bindHolder, type NativeHolder } from './createStyle'
import { platformStyleSheet } from './platform'
import type {
  GlobalProps,
  NativeStyle,
  Styled,
  StyleOptions,
  ThemeProviderProps,
  ThemeScopeProps,
} from './types'

export interface DefaultStyleOptions extends StyleOptions<Theme> {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

/** Makes the default styling: one holder of the base theme, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  const holder: NativeHolder<Theme> = { baseTheme: undefined }
  let bound: NativeStyle<Theme> | undefined
  // The context exists before the style is used, so that it can be exported.
  const ThemeContext = createContext<Theme | undefined>(undefined)

  const getStyle = (): NativeStyle<Theme> => {
    bound ??= bindHolder(holder, ThemeContext)
    return bound
  }

  /** Gives the default style a base theme. Throws once the default style was used. */
  function configure(options: DefaultStyleOptions): void {
    if (bound) throw new Error('configure must be called before the default style is used.')
    holder.baseTheme = options.theme
  }

  const styled = ((tag, options) => getStyle().styled(tag, options)) as Styled<Theme>

  // An object sheet is registered on first read, so a module can create one before `configure` is called.
  const StyleSheet: NativeStyle<Theme>['StyleSheet'] = {
    ...platformStyleSheet,
    create: ((styles: Record<string, NativeStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as NativeStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as NativeStyle<Theme>['useStyle']

  function useTheme(): Theme {
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

  return {
    configure,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    ThemeScope,
    useThemeClass,
    ThemeContext,
    apply: ((...entries) => getStyle().apply(...entries)) as NativeStyle<Theme>['apply'],
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
