import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'

// The style of every page of the fixture, with a prefix of its own. The server components use its server
// build, the client components its client build.
export const { styled, ThemeProvider, Global } = createStyle(lightTheme, { prefix: 'ppr' })
