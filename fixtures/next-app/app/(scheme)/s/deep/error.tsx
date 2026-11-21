'use client'

import { Card } from '@umber-fixtures/shared/components'

// Rendered by the framework in place of a page of the nested layout that throws.
export default function DeepError() {
  return <Card data-testid="s-deep-error">Something went wrong</Card>
}
