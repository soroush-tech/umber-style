import { Button, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { oneTheme } from '../../../../scheme-themes'
import { ClientThemeProbe } from '../../../client'

// The third level: a page provider under the provider of the nested layout.
export default function OnePage() {
  return (
    <Page data-testid="page-s-one">
      <ThemeProvider theme={oneTheme}>
        <ClientThemeProbe testId="s-one-theme" />
        <Button data-testid="s-one-button">One</Button>
      </ThemeProvider>
    </Page>
  )
}
