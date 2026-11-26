import { createStyle } from '@umber-style/react'
import { lightTheme } from '@umber-fixtures/shared/themes'

// The style of the helpers page under /csp-server, with a prefix of its own and a theme whose breakpoints
// carry helpers as a design system makes them: own members that are not enumerable, closures over the
// sizes. The server components of the page and its client component import this module, so the theme is
// registered on both sides, as the base theme of `createStyle`. Before #81 a server `ThemeProvider` given
// it sent the breakpoints with their helpers, and the development server printed "Only plain objects can
// be passed to Client Components" for each request.

const sizes = { sm: '600px', md: '840px' }

/** The breakpoints, with `up(key)`: the media query from the size of `key`. */
const breakpoints = { ...sizes } as typeof sizes & { up(key: keyof typeof sizes): string }
Object.defineProperty(breakpoints, 'up', {
  value: (key: keyof typeof sizes) => `@media (min-width:${sizes[key]})`,
  enumerable: false,
})

/** The theme of the helpers page: the light theme of the fixtures, with breakpoints that have helpers. */
export const helperTheme = { ...lightTheme, breakpoints }

export const { ThemeProvider, useTheme } = createStyle(helperTheme, { prefix: 'csphelp' })
