import Link from 'next/link'
import { Item, List, OtherCard, Pill, ServerFrame } from '../../parts'

// The page that a client-side navigation goes to: its request renders this page only, with a class and
// an animation of its own, and a props class of the pill that the streaming page does not have, which the
// browser writes after the base class.
export default function CspServerOtherPage() {
  return (
    <ServerFrame testId="page-csp-server-other" title="Other">
      <OtherCard data-testid="csp-server-other-card">Other</OtherCard>
      <Pill size="big" data-testid="csp-server-other-pill">
        Big
      </Pill>
      <List data-testid="csp-server-other-list">
        <Item data-testid="csp-server-other-item-1">One</Item>
        <Item data-testid="csp-server-other-item-2">Two</Item>
      </List>
      <Link href="/csp-server/badge" data-testid="link-csp-server-badge">
        Badge
      </Link>
    </ServerFrame>
  )
}
