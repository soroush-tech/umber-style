import { Page } from '@umber-fixtures/shared/components'

export const dynamic = 'force-dynamic'

// A page that takes its time: the loading state of the nested layout shows first.
export default async function SlowPage() {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return <Page data-testid="page-s-slow">Slow</Page>
}
