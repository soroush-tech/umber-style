import { Card } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import type { ReactNode } from 'react'
import { lateTheme } from '../../../../scheme-themes'

export const dynamic = 'force-dynamic'

// A nested layout that arrives late, with its provider.
export default async function LateLayout({ children }: { children: ReactNode }) {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return (
    <ThemeProvider theme={lateTheme}>
      <Card data-testid="s-late-layout-card">Late layout</Card>
      {children}
    </ThemeProvider>
  )
}
