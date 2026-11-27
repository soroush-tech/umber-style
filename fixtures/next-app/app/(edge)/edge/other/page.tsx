import { OtherCard, Pill, ServerFrame } from '../../../(csp-server)/parts'
import { Runtime } from '../../runtime'

// The page that a client-side navigation goes to: its request renders this page only, with a class and an
// animation of its own.
export default function EdgeOtherPage() {
  return (
    <ServerFrame testId="page-edge-other" title="Other" base="/edge">
      <Runtime />
      <OtherCard data-testid="csp-server-other-card">Other</OtherCard>
      <Pill size="big" data-testid="csp-server-other-pill">
        Big
      </Pill>
    </ServerFrame>
  )
}
