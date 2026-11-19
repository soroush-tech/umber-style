import { createDefaultStyle } from './defaultStyle'

const defaults = createDefaultStyle()

export const {
  configure,
  styled,
  StyleSheet,
  useStyle,
  useTheme,
  ThemeProvider,
  apply,
  themeClass,
} = defaults

export * from './alpha'
export * from './createStyle'
export * from './defaultStyle'
export * from './nativeStyle'
export * from './types'
