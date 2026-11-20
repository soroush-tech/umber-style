import { Button, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { oneTheme } from '../../../../scheme-themes'

// A page provider under the provider of a layout that arrived late.
export default function LatePage() {
  return (
    <Page data-testid="page-s-late">
      <ThemeProvider theme={oneTheme}>
        <Button data-testid="s-late-button">Late</Button>
      </ThemeProvider>
    </Page>
  )
}
