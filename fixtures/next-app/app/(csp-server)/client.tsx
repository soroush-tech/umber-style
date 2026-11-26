'use client'

import { styled } from './style'

// A client component of the badge page under /csp-server, made with the same style as the server components:
// in the client build it keeps the engine's own cache, and the registry of the layout takes the rules of
// its class from the server render. Its style reads a token of the theme, the accent. Below a provider of
// the server build, a client component reads the theme that provider merged over the base theme of the
// client build; where the provider rendered before this module was loaded (the first request of a server,
// hydration, a client-side navigation to the page), the style merges its own base theme under it, so the
// class is the same everywhere (#71, scenario s3 of the end-to-end tests, on /csp-server/badge). After a
// client-side navigation the browser writes the rule of that class into an element with the nonce of the
// page, which the style itself does not have (scenario s4).

const Badge = styled('strong', { name: 'CspServerClientBadge' })(({ theme }) => ({
  display: 'inline-block',
  paddingLeft: 6,
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: theme.palette.accent,
}))

/** A badge rendered by a client component. */
export function ClientBadge() {
  return <Badge data-testid="csp-server-client-badge">Client</Badge>
}
