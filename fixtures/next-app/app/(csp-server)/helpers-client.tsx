'use client'

import { useTheme } from './helpers-style'

/** The media query that a hidden helper of the theme's breakpoints gives, read in a client component. */
export function BreakpointQuery() {
  return <code data-testid="csp-server-helpers-query">{useTheme().breakpoints.up('md')}</code>
}
