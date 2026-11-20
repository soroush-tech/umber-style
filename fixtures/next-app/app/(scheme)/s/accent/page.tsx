import { Card, Page } from '@umber-fixtures/shared/components'
import { ThemeProvider } from '@umber-fixtures/shared/style'
import { accentTheme, otherTheme } from '../../../scheme-themes'
import { ClientProvided } from '../../client'

// A nested provider with another theme than the brand page's, and a server provider under a client one.
export default function AccentPage() {
  return (
    <Page data-testid="page-s-accent">
      <ThemeProvider theme={accentTheme}>
        <Card data-testid="s-accent-card">Accent</Card>
      </ThemeProvider>
      <ClientProvided>
        <ThemeProvider theme={otherTheme}>
          <Card data-testid="s-server-under-client">A server provider under a client one</Card>
        </ThemeProvider>
      </ClientProvided>
    </Page>
  )
}
