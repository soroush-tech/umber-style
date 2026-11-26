import { Suspense } from 'react'
import { Chip, LateCard, ServerFrame } from '../../parts'

// An async server component: it renders late, inside a `Suspense` boundary, and so do its styles. Its
// chip shares the base class of the chip outside the boundary, which the request sent first, and has a
// props class of its own.
async function Late() {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return (
    <LateCard data-testid="csp-server-late">
      <Chip tone="loud" data-testid="csp-server-late-chip">
        Late
      </Chip>
    </LateCard>
  )
}

// A page that streams under the policy: the first flush has the frame and a chip, the late chunk the card.
export default function CspServerStreamPage() {
  return (
    <ServerFrame testId="page-csp-server-stream" title="Streaming">
      <Chip tone="calm" data-testid="csp-server-chip">
        Early
      </Chip>
      <Suspense fallback={<p data-testid="csp-server-fallback">Loading</p>}>
        <Late />
      </Suspense>
    </ServerFrame>
  )
}
