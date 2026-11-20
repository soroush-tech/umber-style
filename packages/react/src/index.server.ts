import { createDefaultStyle } from './defaultStyle.server'

const defaults = createDefaultStyle()

export const {
  configure,
  getEngine,
  styled,
  StyleSheet,
  useStyle,
  readTheme,
  ThemeProvider,
  apply,
  themeClass,
  when,
  whenScheme,
  keyframes,
  globalStyles,
  Global,
} = defaults

export { add, alpha, at, divide, multiply, negate, subtract } from '@umber-style/core'
export * from './createStyle.server'
export * from './defaultStyle.server'
export * from './types'
