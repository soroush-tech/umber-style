import { ServerFrame } from '../../parts'
import { SharedCard } from '../../shared'
import { SharedClientCard } from '../../shared-client'

// One styled component rendered from a server component and from a client component on one page under
// `StyleRegistry` (#91): the rule of its class is in the page once, but in the first HTML of a request
// with no nonce (`?control=no-policy`), where React hoists the server's copy and the registry writes the
// client's.
export default function CspServerSharedPage() {
  return (
    <ServerFrame testId="page-csp-server-shared" title="Shared">
      <SharedCard data-testid="shared-server">server</SharedCard>
      <SharedClientCard />
    </ServerFrame>
  )
}
