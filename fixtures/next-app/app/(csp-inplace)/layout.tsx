import '../(csp-server)/nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from '../(csp-server)/style'

export const metadata = {
  title: 'UmberStyle server components with a nonce, in place',
  icons: { icon: 'data:,' },
}

// The layout of /csp-server with no `StyleRegistry`: the routes under /csp-inplace prove the fallback, the
// styles of the server components sent in place in the first HTML and handed to the head at hydration.
// proxy.ts sends them with the same strict policy, and the nonce comes from the same source.
export default function CspInPlaceLayout({ children }: { children: ReactNode }) {
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
