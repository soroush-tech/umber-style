import { Card } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import type { ReactNode } from 'react'
import { deepTheme } from '../../../scheme-themes'

// The second level: a nested layout with a provider of its own, and a parallel slot beside its pages.
export default function DeepLayout({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  return (
    <ThemeProvider theme={deepTheme}>
      <Card data-testid="s-deep-card">Deep layout</Card>
      {children}
      <aside data-testid="s-panel">{panel}</aside>
    </ThemeProvider>
  )
}
