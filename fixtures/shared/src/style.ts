import { createStyle } from '@umber-style/react'
import { darkTheme, lightTheme } from './themes'

// One style for the whole app. It is imported by the server and by the browser, so both make the
// same class names: the prefix and the themes are the same.
export const style = createStyle(lightTheme, { prefix: 'umber' })

export const { styled, ThemeProvider, themeClass, StyleSheet } = style

// The classes of the root theme, for <html>. Asking for them makes their rules, so this runs at start-up.
export const lightClass = themeClass(lightTheme, 'light')
export const darkClass = themeClass(darkTheme, 'dark')

/** A shouldForwardProp that keeps the named style props off the element. */
export const omitProps = (...names: string[]) => {
  const hidden = new Set(names)
  return (prop: string) => !hidden.has(prop)
}
