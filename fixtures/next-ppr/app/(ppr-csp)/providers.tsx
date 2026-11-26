'use client'

import createCache from '@umber-style/cache'
import { useState, type ReactNode } from 'react'
import { StyleRegistry } from 'umber-style/react/next'
import { Global, ThemeProvider } from '../style'

// The providers file of /ppr-csp: a cache for each request with the nonce of the response, given to
// `StyleRegistry`, which writes the rules it gets with that nonce. In the browser the same prop gives the
// browser's cache its nonce.
export function NonceProviders({
  nonce,
  children,
}: Readonly<{ nonce?: string; children: ReactNode }>) {
  const [cache] = useState(() => createCache({ key: 'ppr', nonce }))
  return (
    <StyleRegistry cache={cache}>
      <ThemeProvider theme={{ palette: { surface: '#efe9e3' } }}>
        <Global
          styles={(theme) => ({
            body: {
              margin: 0,
              backgroundColor: theme.palette.background,
              fontFamily: 'sans-serif',
            },
          })}
        />
        {children}
      </ThemeProvider>
    </StyleRegistry>
  )
}
