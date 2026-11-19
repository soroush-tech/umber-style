import { createLazyEngine, type SheetEntry, type SheetStyles, type Theme } from '@umber-style/core'
import { bindEngine } from './createStyle'
import type {
  DefaultStyleOptions,
  SheetDefinition,
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

  const StyleSheet: WebStyle<Theme>['StyleSheet'] = {
    create: (styles) => getStyle().StyleSheet.create(styles),
  }

  function useStyle<S extends SheetStyles>(sheet: SheetDefinition<S, SheetEntry>) {
    return getStyle().useStyle(sheet)
  }

  function useTheme(): Theme {
    return getStyle().useTheme()
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
    useTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as WebStyle<Theme>['apply'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as WebStyle<Theme>['themeClass'],
  }
}
