import { HomeCard, Item, List, ServerFrame } from '../parts'

// Rendered whole on the first load: the provider of the layout, `Global`, every class of the page, a list
// styled by the place of its items.
export default function CspServerPage() {
  return (
    <ServerFrame testId="page-csp-server" title="Server components with a nonce">
      <HomeCard data-testid="csp-server-home-card">Home</HomeCard>
      <List data-testid="csp-server-list">
        <Item data-testid="csp-server-item-1">One</Item>
        <Item data-testid="csp-server-item-2">Two</Item>
        <Item data-testid="csp-server-item-3">Three</Item>
      </List>
    </ServerFrame>
  )
}
