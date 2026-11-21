import { createDefaultStyle } from './defaultStyle'

const defaults = createDefaultStyle()

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
