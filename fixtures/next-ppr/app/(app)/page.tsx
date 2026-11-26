import { Counter } from '@umber-fixtures/shared/interactive'
import { HomePage } from '@umber-fixtures/shared/pages'

// A server component page with a client component inside it.
export default function Page() {
  return <HomePage extra={<Counter />} />
}
