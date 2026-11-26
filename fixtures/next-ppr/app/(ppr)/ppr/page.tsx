import { Suspense } from 'react'
import { ClientChip, LateClientChip } from '../../client'
import { Fallback, Late, LateCard, PprFrame, ShellCard } from '../../parts'

// The home page: a static shell (the frame, a card, a client chip, the fallback) prerendered at build
// time, and a part that waits for the request and streams in after 800 ms, with a server card and a
// client chip of classes the shell does not have.
export default function PprHomePage() {
  return (
    <PprFrame testId="page-ppr" title="Partial prerendering" base="/ppr">
      <ShellCard data-testid="ppr-shell-card">
        Shell <ClientChip />
      </ShellCard>
      <Suspense fallback={<Fallback data-testid="ppr-fallback">Loading</Fallback>}>
        <Late ms={800}>
          <LateCard data-testid="ppr-late-card">
            Late <LateClientChip />
          </LateCard>
        </Late>
      </Suspense>
    </PprFrame>
  )
}
