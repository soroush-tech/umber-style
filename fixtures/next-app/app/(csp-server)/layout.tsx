import './nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { StyleRegistry } from '@umber-style/react/next'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from './style'

export const metadata = {
  title: 'UmberStyle server components with a nonce',
  icons: { icon: 'data:,' },
}

// A root layout of its own for the routes under /csp-server, which proxy.ts sends with a strict policy
// and a new nonce for each request. Everything styled here is a server component but one badge; the nonce
// of each request comes from the source that `./nonce` registers, not from a prop of this layout, so the
// request of a client-side navigation, which does not render this layout, gets it too. `StyleRegistry`
// writes the styles of the request in the head and before each later piece of the stream.
export default function CspServerLayout({ children }: { children: ReactNode }) {
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
