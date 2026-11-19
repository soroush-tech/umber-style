import { bootScript } from '@umber-fixtures/shared/bootScript'
import { Shell, type LinkComponent } from '@umber-fixtures/shared/shell'
import { darkClass, lightClass, ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Providers } from '../providers'

export const metadata = { title: 'UmberStyle fixture', icons: { icon: 'data:,' } }

// A server component: `ThemeProvider` here is the server build (the `react-server` condition).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={lightClass} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript(lightClass, darkClass) }} />
      </head>
      <body>
        <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
          <Providers>
            <Shell Link={Link as LinkComponent}>{children}</Shell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
