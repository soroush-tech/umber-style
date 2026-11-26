import { ClientBadge } from '../../(csp-server)/client'
import { HomeCard, Item, List, ServerFrame } from '../../(csp-server)/parts'
import { Runtime } from '../runtime'

// The home page of /edge: the parts of /csp-server, a list styled by the place of its items, and a client
// component under the registry.
export default function EdgePage() {
  return (
    <ServerFrame testId="page-edge" title="On the edge runtime" base="/edge">
      <Runtime />
      <HomeCard data-testid="csp-server-home-card">Home</HomeCard>
      <List data-testid="csp-server-list">
        <Item data-testid="csp-server-item-1">One</Item>
        <Item data-testid="csp-server-item-2">Two</Item>
        <Item data-testid="csp-server-item-3">Three</Item>
      </List>
      <ClientBadge />
    </ServerFrame>
  )
}
