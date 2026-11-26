import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'

// The style of the server components under /csp-server, with a prefix of its own: every style element of
// these pages is one of server components, which carries the nonce of its request.
export const { styled, ThemeProvider, Global, keyframes } = createStyle(lightTheme, {
  prefix: 'cspsrv',
})
