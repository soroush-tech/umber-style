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
  when,
  whenScheme,
} = defaults

export { at } from '@umber-style/core'
export * from './alpha'
export * from './calc'
export * from './createStyle'
export * from './defaultStyle'
export * from './nativeStyle'
export * from './types'
