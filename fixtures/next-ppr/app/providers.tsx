'use client'

import { ThemeProvider } from '@umber-fixtures/shared/style'
import { lightTheme } from '@umber-fixtures/shared/themes'
import type { ReactNode } from 'react'

// The client build of the root provider: client components read their theme from its context. It
// imports the theme itself, because a theme holds functions and cannot cross as a prop.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
      {children}
    </ThemeProvider>
  )
}
