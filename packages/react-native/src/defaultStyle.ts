import type { SheetStyles, StyleObject, Theme } from '@umber-style/core'
import { bindHolder, type NativeHolder } from './createStyle'
import { platformStyleSheet } from './platform'
import type {
  NativeStyle,
  SheetDefinition,
  Styled,
  StyleOptions,
  ThemeProviderProps,
} from './types'

export interface DefaultStyleOptions extends StyleOptions<Theme> {
  /** The base theme, for an app that has no provider at all. */
  theme?: Theme
}

/** Makes the default styling: one holder of the base theme, behind `styled`, `ThemeProvider` and the rest. */
export function createDefaultStyle() {
  const holder: NativeHolder<Theme> = { baseTheme: undefined }
  let bound: NativeStyle<Theme> | undefined

  const getStyle = (): NativeStyle<Theme> => {
    bound ??= bindHolder(holder)
    return bound
  }

  /** Gives the default style a base theme. Throws once the default style was used. */
  function configure(options: DefaultStyleOptions): void {
    if (bound) throw new Error('configure must be called before the default style is used.')
    holder.baseTheme = options.theme
  }

  const styled = ((tag, options) => getStyle().styled(tag, options)) as Styled<Theme>

  const StyleSheet: NativeStyle<Theme>['StyleSheet'] = {
    ...platformStyleSheet,
    create: (styles) => getStyle().StyleSheet.create(styles),
  }

  function useStyle<S extends SheetStyles>(sheet: SheetDefinition<S, StyleObject>) {
    return getStyle().useStyle(sheet)
  }

  function useTheme(): Theme {
    return getStyle().useTheme()
  }

  function ThemeProvider(props: ThemeProviderProps<Theme>) {
    return getStyle().ThemeProvider(props)
  }

  return {
    configure,
    styled,
    StyleSheet,
    useStyle,
    useTheme,
    ThemeProvider,
    apply: ((...entries) => getStyle().apply(...entries)) as NativeStyle<Theme>['apply'],
    themeClass: ((theme, colorScheme) =>
      getStyle().themeClass(theme, colorScheme)) as NativeStyle<Theme>['themeClass'],
  }
}
