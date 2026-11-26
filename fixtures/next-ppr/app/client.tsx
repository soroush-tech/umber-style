'use client'

import { styled } from './style'

// Client components of the pages, made with the same style as the server components: in the client build
// they keep the engine's own cache, and the registry of the layout takes the rules of their classes from
// the server render, in the shell at build time or in the part streamed at request time.

const Chip = styled('strong', { name: 'PprClientChip' })(({ theme }) => ({
  display: 'inline-block',
  paddingLeft: 6,
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: theme.palette.accent,
}))

const LateChip = styled('em', { name: 'PprLateClientChip' })(({ theme }) => ({
  display: 'inline-block',
  paddingLeft: 14,
  color: theme.palette.primary,
}))

/** A chip of the static shell, rendered by a client component. */
export function ClientChip() {
  return <Chip data-testid="ppr-client-chip">Client</Chip>
}

/** A chip of the late part, rendered by a client component: a class the shell does not have. */
export function LateClientChip() {
  return <LateChip data-testid="ppr-late-client-chip">Late client</LateChip>
}
