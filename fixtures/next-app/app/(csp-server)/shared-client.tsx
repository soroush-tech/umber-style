'use client'

import { SharedCard } from './shared'

/** The card of /csp-server/shared, rendered by a client component. */
export function SharedClientCard() {
  return <SharedCard data-testid="shared-client">client</SharedCard>
}
