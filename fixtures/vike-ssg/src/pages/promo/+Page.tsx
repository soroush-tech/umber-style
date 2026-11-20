import { HeaderOverride } from '@umber-fixtures/shared/components'
import { PromoPage } from '@umber-fixtures/shared/pages'

export default function Page() {
  return <PromoPage override={<HeaderOverride />} />
}
