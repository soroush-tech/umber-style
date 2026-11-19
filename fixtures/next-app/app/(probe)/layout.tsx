import { ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import type { ReactNode } from 'react'

// A second root layout, whose root theme has a breakpoint that the base theme does not: the page
// below shows which of the two a server component reads.
const probeTheme = { ...lightTheme, breakpoints: ['641px'] }

export const metadata = { title: 'UmberStyle probe', icons: { icon: 'data:,' } }

export default function ProbeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={probeTheme} isRoot>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
