import { readSharedState } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle'

// One default style for every copy of the binding in the program, so that a component of one copy reads
// the provider of another.
const defaults = readSharedState('vue.default-style@1', createDefaultStyle)

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
  apply,
  css,
  themeClass,
  when,
  whenScheme,
  keyframes,
  globalStyles,
  Global,
} = defaults

export { add, alpha, at, divide, multiply, negate, subtract } from '@umber-style/core'
export { CacheProvider } from './CacheProvider'
export * from './createStyle'
export * from './defaultStyle'
export * from './types'
