import { Shell } from '@umber-fixtures/shared/shell'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import { StrictMode, type ReactNode } from 'react'

/** The same tree on the server and in the browser: strict mode, the root provider, the frame, and the page. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
        <Shell>{children}</Shell>
      </ThemeProvider>
    </StrictMode>
  )
}
