'use client'

import { styled } from './style'

// A client component of the badge page under /csp-server, made with the same style as the server components:
// in the client build it keeps the engine's own cache, and the registry of the layout takes the rules of
// its class from the server render. Its style reads a token of the theme, the accent. Below a provider of
// the server build, a client component reads the theme that provider merged over the base theme of the
// client build, which a process has only once a style of the client build of the prefix is loaded: until
// then the token has no value, and the class differs from the one the same component makes where that
// style is loaded (#71, a known failure of scenario s3 of the end-to-end tests, on /csp-server/badge).

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
