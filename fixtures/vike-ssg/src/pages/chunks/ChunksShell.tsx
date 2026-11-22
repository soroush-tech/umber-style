import { Hydrated } from '@umber-fixtures/shared/interactive'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import type { UmberCache } from '@umber-style/cache'
import { CacheProvider } from '@umber-style/react'
import { StrictMode, type ReactNode } from 'react'

/** The same tree on the server and in the browser: a cache of its own for the page, the theme, its global rules. */
export function ChunksShell({ cache, children }: { cache: UmberCache; children: ReactNode }) {
  return (
    <StrictMode>
      <CacheProvider value={cache}>
        <ThemeProvider theme={lightTheme}>
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
          <Hydrated />
        </ThemeProvider>
      </CacheProvider>
    </StrictMode>
  )
}
