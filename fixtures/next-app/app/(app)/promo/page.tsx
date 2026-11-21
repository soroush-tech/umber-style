import { ClientHeaderOverride } from '@umber-fixtures/shared/interactive'
import { PromoPage } from '@umber-fixtures/shared/pages'

// Variant (a): the global rule is written by a client component of the page.
export default function Page() {
  return <PromoPage override={<ClientHeaderOverride />} />
}
