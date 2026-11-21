import { Muted } from '@umber-fixtures/shared/components'
import { ClientHeaderOverride } from '@umber-fixtures/shared/interactive'
import { PromoPage } from '@umber-fixtures/shared/pages'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

// An async server component: it renders late, inside a Suspense boundary, with the client component
// that writes the global rule.
async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return (
    <>
      <ClientHeaderOverride />
      <Muted data-testid="late-promo">Arrived late</Muted>
    </>
  )
}

// Variant (c): the client component of the global rule is inside a boundary that streams late.
export default function Page() {
  return (
    <PromoPage
      testId="page-promo-stream"
      override={
        <Suspense fallback={<Muted data-testid="fallback">Loading</Muted>}>
          <Slow />
        </Suspense>
      }
    />
  )
}
