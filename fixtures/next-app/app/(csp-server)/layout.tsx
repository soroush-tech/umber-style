import './nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from './style'

export const metadata = {
  title: 'UmberStyle server components with a nonce',
  icons: { icon: 'data:,' },
}

// A root layout of its own for the routes under /csp-server, which proxy.ts sends with a strict policy
// and a new nonce for each request. Everything styled here is a server component; the nonce of each
// request comes from the source that `./nonce` registers, not from a prop of this layout, so the request
// of a client-side navigation, which does not render this layout, gets it too.
export default function CspServerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
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
        <Hydrated />
      </body>
    </html>
  )
}
