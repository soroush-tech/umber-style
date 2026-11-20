import { Card, Heading, Muted, Page } from '@umber-fixtures/shared/components'
import { Global, styled } from '@umber-fixtures/shared/style'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

const Late = styled('aside', { name: 'Late' })(({ theme }) => ({
  borderTop: `2px solid ${theme.palette.primary}`,
  paddingTop: theme.space[2],
}))

// An async server component: it renders late, inside a Suspense boundary, and so do its styles.
async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return (
    <Late data-testid="late">
      <Card>
        <Muted>Arrived late</Muted>
      </Card>
    </Late>
  )
}

export default function StreamPage() {
  return (
    <Page data-testid="page-stream">
      {/* A global rule of this page only, written by a server component. */}
      <Global styles={{ '[data-testid="page-stream"] h1': { textDecorationLine: 'underline' } }} />
      <Heading>Streaming</Heading>
      <Suspense fallback={<Muted data-testid="fallback">Loading</Muted>}>
        <Slow />
      </Suspense>
    </Page>
  )
}
