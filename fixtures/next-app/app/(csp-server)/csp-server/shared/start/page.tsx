import Link from 'next/link'
import { ServerFrame } from '../../../parts'

// The page that a client-side navigation to /csp-server/shared starts from: it renders no shared card, so
// the page reached brings its class from both sides.
export default function CspServerSharedStartPage() {
  return (
    <ServerFrame testId="page-csp-server-shared-start" title="Shared start">
      <Link href="/csp-server/shared" data-testid="link-csp-server-shared">
        Shared
      </Link>
    </ServerFrame>
  )
}
