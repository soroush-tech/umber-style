import { OpenPanel, ToneToggle } from '../../interactive'
import { ServerFrame } from '../../parts'

// The page of the client components that make a class in the browser after a click: a tone that the first
// HTML does not have, and a panel that only the browser renders.
export default function CspServerInteractivePage() {
  return (
    <ServerFrame testId="page-csp-server-interactive" title="Interactive">
      <ToneToggle />
      <OpenPanel />
    </ServerFrame>
  )
}
