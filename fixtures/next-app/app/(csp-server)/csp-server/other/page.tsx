import { OtherCard, ServerFrame } from '../../parts'

// The page that a client-side navigation goes to: its request renders this page only, with a class and
// an animation of its own, whose style elements React inserts in the browser under the policy.
export default function CspServerOtherPage() {
  return (
    <ServerFrame testId="page-csp-server-other" title="Other">
      <OtherCard data-testid="csp-server-other-card">Other</OtherCard>
    </ServerFrame>
  )
}
