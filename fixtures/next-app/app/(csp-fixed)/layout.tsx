import '../(csp-server)/nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { StyleRegistry } from '@umber-style/react/next'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from './style'

export const metadata = {
  title: 'UmberStyle server components with a fixed nonce',
  icons: { icon: 'data:,' },
}

// A root layout of its own for the routes under /csp-fixed, which proxy.ts sends with a strict policy whose
// nonce is the same in every response. The engine has that nonce on its cache and no source of its own: the
// source that /csp-server registers (imported above, so that the process has it whatever route is
// served first) answers `undefined` here, because proxy.ts sets no `x-nonce` for these routes, and the
// request gets the nonce of the cache. `StyleRegistry` writes the styles of the request in the head.
export default function CspFixedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyleRegistry>
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
        <Hydrated />
      </body>
    </html>
  )
}
