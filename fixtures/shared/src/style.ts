import { createStyle } from '@umber-style/react'
import { darkTheme, lightTheme } from './themes'

/**
 * The nonce of the page in the browser: that of its scripts, which a page sent under a content security
 * policy carries (the App Router puts the policy's nonce on its scripts); undefined on a server, and on
 * a page with no policy.
 */
const readPageNonce = (): string | undefined =>
  typeof document === 'undefined'
    ? undefined
    : document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || undefined

// One style for the whole app. It is imported by the server and by the browser, so both make the
// same class names: the prefix and the themes are the same. Its own cache makes a style element in the
// browser as soon as it is made, and writes the rules of the theme classes below into it: under a
// strict policy that element needs the page's nonce, which is not in a rule, a class or the stamp.
export const style = createStyle(lightTheme, { prefix: 'umber', nonce: readPageNonce() })

export const {
  styled,
  ThemeProvider,
  themeClass,
  StyleSheet,
  Global,
  keyframes,
  globalStyles,
  css,
} = style

// The classes of the root theme, for <html>. Asking for them makes their rules, so this runs at start-up.
export const lightClass = themeClass(lightTheme, 'light')
export const darkClass = themeClass(darkTheme, 'dark')

/** A shouldForwardProp that keeps the named style props off the element. */
export const omitProps = (...names: string[]) => {
  const hidden = new Set(names)
  return (prop: string) => !hidden.has(prop)
}
