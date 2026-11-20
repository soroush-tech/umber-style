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
  ThemeScope,
  useThemeClass,
  ThemeContext,
  apply,
  themeClass,
  when,
  whenScheme,
  keyframes,
  globalStyles,
  Global,
} = defaults

export { add, alpha, at, divide, multiply, negate, subtract } from '@umber-style/core'
export * from './createStyle'
export * from './defaultStyle'
export * from './types'
