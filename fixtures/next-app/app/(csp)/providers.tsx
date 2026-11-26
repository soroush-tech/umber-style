'use client'

import createCache from '@umber-style/cache'
import { StyleRegistry } from '@umber-style/react/next'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { darkTheme, lightTheme } from '@umber-fixtures/shared/themes'
import { useState, type ReactNode } from 'react'

// The providers file of the routes under /csp, under a strict content security policy: a cache for each
// request with the nonce of the response, given to `StyleRegistry`, which gives it to the client
// components below and writes the rules it gets with that nonce. The nonce comes as a prop from the
// server layout, which read it from the request; in the browser the same prop gives the browser's cache
// its nonce, so the rules it writes after hydration are let in too. app/(registry)/providers.tsx keeps a
// registry written by hand.
//
// As in the registry, a button gives the outermost provider the dark theme: the browser's cache then
// writes the rules of that theme, after hydration, under the policy.
export default function Providers({
  nonce,
  children,
}: Readonly<{ nonce?: string; children: ReactNode }>) {
  const [cache] = useState(() => createCache({ key: 'umber', nonce }))
  const [theme, setTheme] = useState(lightTheme)
  return (
    <StyleRegistry cache={cache}>
      <ThemeProvider theme={theme}>
        <Global
          styles={(theme) => ({
            '*, *::before, *::after': { boxSizing: 'border-box' },
            body: {
              margin: 0,
              backgroundColor: theme.palette.background,
              color: theme.palette.text,
              fontFamily: 'sans-serif',
            },
          })}
        />
        {children}
        <button type="button" data-testid="csp-theme-switch" onClick={() => setTheme(darkTheme)}>
          Dark
        </button>
      </ThemeProvider>
    </StyleRegistry>
  )
}
