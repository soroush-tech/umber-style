import { Button, Card, Heading, Muted, Page } from '@umber-fixtures/shared/components'
import { keyframes, styled } from '@umber-fixtures/shared/style'

const rise = keyframes({ from: { opacity: 0.5 }, to: { opacity: 1 } }, { label: 'chunks-rise' })

const Rise = styled('span', { name: 'ChunksRise' })(({ theme }) => ({
  display: 'inline-block',
  color: theme.palette.accent,
  animation: `${rise} 2s ease-in-out infinite alternate`,
}))

// A page whose CSS the server instance decides from its HTML (see +onRenderHtml.tsx).
export default function ChunksPage() {
  return (
    <Page data-testid="page-chunks">
      <Heading>Chunks</Heading>
      <Card data-testid="chunks-card">
        <Muted>From chunks</Muted>
        <Button data-testid="chunks-button">Save</Button>
        <Rise data-testid="chunks-rise">Rising</Rise>
      </Card>
    </Page>
  )
}
