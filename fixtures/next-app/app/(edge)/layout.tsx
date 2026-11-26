import '../(csp-server)/nonce'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { StyleRegistry } from '@umber-style/react/next'
import type { ReactNode } from 'react'
import { Global, ThemeProvider } from '../(csp-server)/style'

// Every route under /edge renders on the edge runtime of the framework (deprecated in Next.js 16, still
// built): the segment config of a layout holds for the pages below it.
export const runtime = 'edge'

export const metadata = {
  title: 'UmberStyle on the edge runtime',
  icons: { icon: 'data:,' },
}

// The root layout of /edge, the one of /csp-server on the edge runtime: proxy.ts sends these routes with a
// strict policy and a new nonce for each request, the nonce comes from the source that
// `../(csp-server)/nonce` registers (in the edge bundle, which has modules of its own), and
// `StyleRegistry` writes the styles of the request in the head and before each later piece of the stream.
export default function EdgeLayout({ children }: { children: ReactNode }) {
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
