import { FixedFrame, HomeCard } from '../parts'

// Rendered whole on the first load: the provider of the layout, `Global` and every class of the page.
export default function CspFixedPage() {
  return (
    <FixedFrame testId="page-csp-fixed">
      <HomeCard data-testid="csp-fixed-home-card">Home</HomeCard>
    </FixedFrame>
  )
}
