import { Card } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import type { ReactNode } from 'react'
import { otherTheme } from '../../../scheme-themes'

// Another nested layout under the same root, with another provider.
export default function OtherLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={otherTheme}>
      <Card data-testid="s-other-card">Other layout</Card>
      {children}
    </ThemeProvider>
  )
}
