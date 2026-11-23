import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import { createStyle } from '@umber-style/vue'

/** The nonce of the page, which the server puts on a `<meta property="csp-nonce">`; none on the server, where each request gives its own to `extractPageStyles`. */
const readPageNonce = (): string | undefined =>
  typeof document === 'undefined'
    ? undefined
    : document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce

// One style for the server and the browser: the same prefix and themes make the same class names. A
// style element that the browser's cache makes carries the nonce of the page.
export const style = createStyle(lightTheme, { prefix: 'umber', nonce: readPageNonce() })
export const { styled, ThemeProvider, themeClass, Global, keyframes, globalStyles } = style

export const lightClass = themeClass(lightTheme, 'light')
export const darkClass = themeClass(darkTheme, 'dark')

/** A shouldForwardProp that keeps the named style attributes off the element. */
export const omitProps = (...names: string[]) => {
  const hidden = new Set(names)
  return (prop: string) => !hidden.has(prop)
}
