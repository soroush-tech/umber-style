import { Card, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { brandLight } from '../../scheme-themes'

// A page provider with no provider in the layout: it is the outermost one, with a partial theme.
export default function BarePage() {
  return (
    <ThemeProvider theme={brandLight}>
      <Page data-testid="page-bare">
        <Card data-testid="bare-card">Bare</Card>
      </Page>
    </ThemeProvider>
  )
}
