import { OtherCard, PprFrame } from '../../../parts'

// The page that a client-side navigation goes to: all of it in the static shell, with a class of its own.
export default function PprOtherPage() {
  return (
    <PprFrame testId="page-ppr-other" title="Other" base="/ppr">
      <OtherCard data-testid="ppr-other-card">Other</OtherCard>
    </PprFrame>
  )
}
