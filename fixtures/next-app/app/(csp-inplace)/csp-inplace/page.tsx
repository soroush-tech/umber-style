import { HomeCard, ServerFrame } from '../../(csp-server)/parts'

// Rendered whole on the first load: the provider of the layout, `Global` and every class of the page.
export default function CspInPlacePage() {
  return (
    <ServerFrame
      testId="page-csp-server"
      title="Server components with a nonce"
      base="/csp-inplace"
    >
      <HomeCard data-testid="csp-server-home-card">Home</HomeCard>
    </ServerFrame>
  )
}
