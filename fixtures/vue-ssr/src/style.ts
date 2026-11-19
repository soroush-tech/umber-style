import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import { createStyle } from '@umber-style/vue'

// One style for the server and the browser: the same prefix and themes make the same class names.
export const style = createStyle(lightTheme, { prefix: 'umber' })
export const { styled, ThemeProvider, themeClass } = style

export const lightClass = themeClass(lightTheme, 'light')
export const darkClass = themeClass(darkTheme, 'dark')

/** A shouldForwardProp that keeps the named style attributes off the element. */
export const omitProps = (...names: string[]) => {
  const hidden = new Set(names)
  return (prop: string) => !hidden.has(prop)
}
