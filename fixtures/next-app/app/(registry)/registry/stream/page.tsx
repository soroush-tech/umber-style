import { Suspense } from 'react'
import { LateNote, RegistryFrame, StreamFallback } from '../../parts'

export const dynamic = 'force-dynamic'

// An async server component: the client component it renders arrives in a later chunk of the stream,
// with classes that the first flush does not have.
async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return <LateNote />
}

export default function RegistryStreamPage() {
  return (
    <RegistryFrame testId="page-registry-stream" title="Streaming">
      <Suspense fallback={<StreamFallback />}>
        <Slow />
      </Suspense>
    </RegistryFrame>
  )
}
