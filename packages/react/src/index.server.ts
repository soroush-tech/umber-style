import { readSharedState } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle.server'

// One default style for every copy of the binding in the program, so that a component of one copy reads
// the provider and the cache of another.
const defaults = readSharedState('react.server-default-style@1', createDefaultStyle)

export const {
  configure,
  getEngine,
  styled,
  StyleSheet,
  useStyle,
  useStyleValue,
  useTheme,
  readTheme,
  ThemeProvider,
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
export { setNonceSource, type NonceSource } from '@umber-style/core'
export * from './createStyle.server'
export * from './defaultStyle.server'
export * from './types'
