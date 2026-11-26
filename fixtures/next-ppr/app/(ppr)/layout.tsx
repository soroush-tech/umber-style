import { Hydrated } from '@umber-fixtures/shared/interactive'
import type { ReactNode } from 'react'
import { StyleRegistry } from 'umber-style/react/next'
import { Global, ThemeProvider } from '../style'

export const metadata = { title: 'UmberStyle partial prerendering', icons: { icon: 'data:,' } }

// The root layout of the pages with no policy: a server component, the registry from the subpath of the
// umbrella, a provider and `Global` of the server build. All of it is in the static shell.
export default function PprLayout({ children }: { children: ReactNode }) {
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
