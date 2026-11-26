import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'
import { FIXED_NONCE } from './nonce'

// The style of the server components under /csp-fixed, with a prefix of its own and a FIXED nonce on its
// cache: no request gives it another, so every style element of these pages carries the same one.
export const { styled, ThemeProvider, Global } = createStyle(lightTheme, {
  prefix: 'cspfix',
  nonce: FIXED_NONCE,
})
