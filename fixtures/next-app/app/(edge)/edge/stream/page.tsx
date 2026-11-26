import { Suspense } from 'react'
import { Chip, LateCard, Late, ServerFrame, Tag } from '../../../(csp-server)/parts'
import { Runtime } from '../../runtime'

// A page that streams on the edge runtime: a chip in the first piece, and a card with a class of its own
// in a piece 800 ms later.
export default function EdgeStreamPage() {
  return (
    <ServerFrame testId="page-edge-stream" title="Streaming" base="/edge">
      <Runtime />
      <Chip tone="calm" data-testid="csp-server-chip">
        Early
      </Chip>
      <Suspense fallback={<Tag data-testid="csp-server-fallback">Loading</Tag>}>
        <Late ms={800}>
          <LateCard data-testid="csp-server-late">
            <Chip tone="loud" data-testid="csp-server-late-chip">
              Late
            </Chip>
          </LateCard>
        </Late>
      </Suspense>
    </ServerFrame>
  )
}
