import {
  createDeferredRecord,
  createLazyEngine,
  globalStyles,
  keyframes,
  type Theme,
  type WebStyleObject,
} from '@umber-style/core'
import { bindEngine } from './createStyle'
import type {
  DefaultStyleOptions,
  GlobalProps,
  Styled,
  WebStyle,
  WebThemeProviderProps,
} from './types'

/** Makes the default styling: one engine, made on first use, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  let pending: DefaultStyleOptions = {}
  let bound: WebStyle<Theme> | undefined

  const getStyle = (): WebStyle<Theme> => {
    if (!bound) {
      const engine = pending.engine ?? createLazyEngine<Theme>(pending)
      if (pending.theme) engine.setTheme(pending.theme)
      bound = bindEngine(engine, pending)
    }
    return bound
  }

  /** Sets the options of the default engine, and gives it a base theme or an engine to share. Throws once the default style was used. */
  function configure(options: DefaultStyleOptions): void {
    if (bound) throw new Error('configure must be called before the default style is used.')
    pending = options
  }

  const styled = ((tag, options) => getStyle().styled(tag, options)) as Styled<Theme>

  // An object sheet is made on first read, so a module can create one before `configure` is called.
  const StyleSheet: WebStyle<Theme>['StyleSheet'] = {
    create: ((styles: Record<string, WebStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as WebStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as WebStyle<Theme>['useStyle']

  function useTheme(): Theme {
    return getStyle().useTheme()
  }

  function ThemeProvider(props: WebThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  function Global(props: GlobalProps<Theme>) {
    return getStyle().Global(props)
  }

  return {
    configure,
    getEngine: () => getStyle().engine,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as WebStyle<Theme>['apply'],
    when: ((theme, colorScheme) => getStyle().when(theme, colorScheme)) as WebStyle<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as WebStyle<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as WebStyle<Theme>['themeClass'],
    // They need no engine, so a module can call them before `configure`.
    keyframes: keyframes as WebStyle<Theme>['keyframes'],
    globalStyles: globalStyles as WebStyle<Theme>['globalStyles'],
    Global,
  }
}
