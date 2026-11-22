import { readSharedState } from '@umber-style/core'
import { createDefaultStyle } from './defaultStyle'

// One default style for every copy of the binding in the program, so that a component of one copy reads
// the provider of another.
const defaults = readSharedState('react-native.default-style@1', createDefaultStyle)

export const {
  configure,
  styled,
  StyleSheet,
  useStyle,
  useTheme,
  ThemeProvider,
  ThemeScope,
  useThemeClass,
  useMediaQuery,
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

export { at } from '@umber-style/core'
export { CacheProvider } from './CacheProvider'
export * from './alpha'
export * from './calc'
export { createStyle } from './createStyle'
export * from './defaultStyle'
export * from './nativeStyle'
export type { NativeLength, NativeTheme } from './nativeTheme'
export * from './types'
export type { MediaQueryOptions } from './windowState'
