import { Card, Page } from '@umber-fixtures/shared/components'

// Server components and no provider anywhere: styles render, with no theme on the page.
export default function NonePage() {
  return (
    <Page data-testid="page-bare-none">
      <Card data-testid="none-card">No provider</Card>
    </Page>
  )
}
