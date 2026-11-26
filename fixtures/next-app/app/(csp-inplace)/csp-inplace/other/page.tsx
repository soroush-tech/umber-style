import { OtherCard, ServerFrame } from '../../../(csp-server)/parts'

// The page that a client-side navigation goes to: its request renders this page only, with a class and
// an animation of its own, which the browser writes into the head under the policy.
export default function CspInPlaceOtherPage() {
  return (
    <ServerFrame testId="page-csp-server-other" title="Other" base="/csp-inplace">
      <OtherCard data-testid="csp-server-other-card">Other</OtherCard>
    </ServerFrame>
  )
}
