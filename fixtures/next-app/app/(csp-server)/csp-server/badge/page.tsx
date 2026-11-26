import { ClientBadge } from '../../client'
import { ServerFrame } from '../../parts'

// The page of the client badge, on a page of its own: the badge reads a token below the provider of the
// server build and hits #71, which the home page must not (its scenario would then be hidden by the
// known failure). Its scenario is marked as known.
export default function CspServerBadgePage() {
  return (
    <ServerFrame testId="page-csp-server-badge" title="Badge">
      <ClientBadge />
    </ServerFrame>
  )
}
