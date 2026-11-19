import { createDefaultStyle } from './defaultStyle'

const defaults = createDefaultStyle()

export const {
  configure,
  getEngine,
  styled,
  StyleSheet,
  useStyle,
  useTheme,
  ThemeProvider,
  apply,
  themeClass,
  when,
  whenScheme,
} = defaults

export * from './createStyle'
export * from './defaultStyle'
export * from './types'
