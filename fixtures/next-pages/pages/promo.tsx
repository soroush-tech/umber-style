import { HeaderOverride } from '@umber-fixtures/shared/components'
import { PromoPage } from '@umber-fixtures/shared/pages'

export default function Page() {
  return <PromoPage override={<HeaderOverride />} />
}

// Rendered on each request, by the one server process: the style cache outlives the request.
export const getServerSideProps = async () => ({ props: {} })
