import { Suspense } from 'react'
import { LateNote, StreamFallback } from '../../../(registry)/parts'
import { CspFrame } from '../../parts'

// An async server component: the client component it renders arrives in a later chunk of the stream,
// with classes that the first flush does not have, in a style element of its own.
async function Slow() {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  return <LateNote />
}

export default function CspStreamPage() {
  return (
    <CspFrame testId="page-csp-stream" title="Streaming">
      <Suspense fallback={<StreamFallback />}>
        <Slow />
      </Suspense>
    </CspFrame>
  )
}
