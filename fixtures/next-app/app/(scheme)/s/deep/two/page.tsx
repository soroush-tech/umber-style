import { Button, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { twoTheme } from '../../../../scheme-themes'

// The third level, with another theme: a navigation from the first renders only this page.
export default function TwoPage() {
  return (
    <Page data-testid="page-s-two">
      <ThemeProvider theme={twoTheme}>
        <Button data-testid="s-two-button">Two</Button>
      </ThemeProvider>
    </Page>
  )
}
