import { readSharedState } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle'

// One default style for every copy of the binding in the program, so that a component of one copy reads
// the provider and the cache of another.
const defaults = readSharedState('react.default-style@1', createDefaultStyle)

export const {
  configure,
  getEngine,
  styled,
  StyleSheet,
  useStyle,
  useStyleValue,
  useTheme,
  ThemeProvider,
  ThemeScope,
  useThemeClass,
  ThemeContext,
  apply,
  css,
  themeClass,
  when,
  whenScheme,
  keyframes,
  globalStyles,
  Global,
} = defaults

export { add, alpha, at, divide, multiply, negate, state, subtract } from '@umber-style/core'
export { CacheProvider } from './CacheProvider'
export { useMediaQuery, type MediaQueryOptions } from './useMediaQuery'
export * from './createStyle'
export * from './defaultStyle'
export * from './types'
