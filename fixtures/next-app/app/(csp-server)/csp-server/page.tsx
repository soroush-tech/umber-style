import { HomeCard, ServerFrame } from '../parts'

// Rendered whole on the first load: the provider of the layout, `Global` and every class of the page.
export default function CspServerPage() {
  return (
    <ServerFrame testId="page-csp-server" title="Server components with a nonce">
      <HomeCard data-testid="csp-server-home-card">Home</HomeCard>
    </ServerFrame>
  )
}
