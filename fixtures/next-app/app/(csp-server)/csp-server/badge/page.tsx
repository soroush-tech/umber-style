import { ClientBadge } from '../../client'
import { ServerFrame } from '../../parts'

// The page of the client badge, on a page of its own: the badge reads a token below the provider of the
// server build (#71), and the only client module of this style is loaded by this page, so its first
// request is the first time a server loads it, and a navigation to it is the first time the browser does.
export default function CspServerBadgePage() {
  return (
    <ServerFrame testId="page-csp-server-badge" title="Badge">
      <ClientBadge />
    </ServerFrame>
  )
}
