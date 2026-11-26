import { FixedFrame, OtherCard } from '../../parts'

// The page that a client-side navigation goes to: its request renders this page only, with a class of its
// own, which the browser writes into the head with the document's nonce.
export default function CspFixedOtherPage() {
  return (
    <FixedFrame testId="page-csp-fixed-other">
      <OtherCard data-testid="csp-fixed-other-card">Other</OtherCard>
    </FixedFrame>
  )
}
