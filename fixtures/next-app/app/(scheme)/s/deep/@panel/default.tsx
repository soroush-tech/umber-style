import { Card } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { panelTheme } from '../../../../scheme-themes'

// A parallel slot with a provider of its own.
export default function Panel() {
  return (
    <ThemeProvider theme={panelTheme}>
      <Card data-testid="s-panel-card">Panel</Card>
    </ThemeProvider>
  )
}
