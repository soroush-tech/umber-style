import { Suspense } from 'react'
import { ClientChip, LateClientChip } from '../../client'
import { Late } from '../../parts'

// The page under the policy: client components only, one at once and one in a part that streams later.
export default function PprCspPage() {
  return (
    <main data-testid="page-ppr-csp">
      <ClientChip />
      <Suspense fallback={<p data-testid="ppr-fallback">Loading</p>}>
        <Late ms={800}>
          <LateClientChip />
        </Late>
      </Suspense>
    </main>
  )
}
