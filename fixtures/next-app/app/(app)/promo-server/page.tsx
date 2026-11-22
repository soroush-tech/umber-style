import { HeaderOverride } from '@umber-fixtures/shared/components'
import { PromoPage } from '@umber-fixtures/shared/pages'

// Variant (b): the global rule is rendered by a server component of the page (the server build of `Global`).
export default function Page() {
  return <PromoPage override={<HeaderOverride />} testId="page-promo-server" />
}
