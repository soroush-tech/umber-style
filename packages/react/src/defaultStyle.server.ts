import {
  createDeferredRecord,
  createLazyEngine,
  type Theme,
  type WebStyleObject,
} from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import type { DefaultStyleOptions, ServerStyle, Styled, WebThemeProviderProps } from './types'

/** Makes the default styling for server components: one engine, made on first use. */
export function createDefaultStyle() {
  let pending: DefaultStyleOptions = {}
  let bound: ServerStyle<Theme> | undefined

  const getStyle = (): ServerStyle<Theme> => {
    if (!bound) {
      const engine = pending.engine ?? createLazyEngine<Theme>(pending)
      if (pending.theme) engine.setTheme(pending.theme)
      bound = bindEngine(engine)
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
  const StyleSheet: ServerStyle<Theme>['StyleSheet'] = {
    create: ((styles: Record<string, WebStyleObject> | ((theme: Theme) => never)) =>
      typeof styles === 'function'
        ? getStyle().StyleSheet.create(styles)
        : createDeferredRecord(styles, () =>
            getStyle().StyleSheet.create(styles)
          )) as ServerStyle<Theme>['StyleSheet']['create'],
  }

  const useStyle = ((sheet: never) => getStyle().useStyle(sheet)) as ServerStyle<Theme>['useStyle']

  function readTheme(): Theme {
    return getStyle().readTheme()
  }

  function ThemeProvider(props: WebThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  return {
    configure,
    getEngine: () => getStyle().engine,
    styled,
    StyleSheet,
    useStyle,
    readTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as ServerStyle<Theme>['apply'],
    when: ((theme, colorScheme) =>
      getStyle().when(theme, colorScheme)) as ServerStyle<Theme>['when'],
    whenScheme: ((scheme) => getStyle().whenScheme(scheme)) as ServerStyle<Theme>['whenScheme'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as ServerStyle<Theme>['themeClass'],
  }
}
