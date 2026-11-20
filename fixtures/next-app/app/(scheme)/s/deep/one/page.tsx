import { Button, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { oneTheme } from '../../../../scheme-themes'

// The third level: a page provider under the provider of the nested layout.
export default function OnePage() {
  return (
    <Page data-testid="page-s-one">
      <ThemeProvider theme={oneTheme}>
        <Button data-testid="s-one-button">One</Button>
      </ThemeProvider>
    </Page>
  )
}
