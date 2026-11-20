import { Card, Page } from '@umber-fixtures/shared/components'

// No provider in the page: the root theme only.
export default function SchemeHome() {
  return (
    <Page data-testid="page-s-home">
      <Card data-testid="s-home-card">Home</Card>
    </Page>
  )
}
