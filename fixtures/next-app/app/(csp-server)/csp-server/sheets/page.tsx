import type { SheetStyleProp } from '@umber-style/react'
import { ServerFrame } from '../../parts'
import { objectSheet, sheet } from '../../sheets'
import {
  ClientCard,
  ClientClassName,
  ClientOwnHandle,
  ClientPicked,
  ClientSlot,
  ClientUseStyle,
} from '../../sheets-client'
import { styled, useStyle } from '../../style'

// The entries of a sheet in server components and in client components (#88), under the policy of
// /csp-server. Supported: a styled server component given a handle, the slot pattern within the server
// components and within the client components, client components that import the sheet, and a server
// component choosing a client component's style with a plain value. Not supported: a style passed from a
// server component to a client component (the entry it resolved, an entry of an object sheet, a handle, a
// class name), whose CSS does not cross: those cards are unstyled.

const ServerCard = styled('section', { name: 'CspServerSheetServerCard' })({ display: 'block' })

const ServerSlotRoot = styled('section', { name: 'CspServerServerSlot' })({ display: 'block' })

const ServerSlotAvatar = styled('span', { name: 'CspServerServerSlot', slot: 'avatar' })({
  display: 'inline-block',
})

/** A server component of parts, each styled, given the style of each part by its server parent. */
function ServerSlotCard({
  styleProps = {},
}: {
  styleProps?: { root?: SheetStyleProp; avatar?: SheetStyleProp }
}) {
  return (
    <ServerSlotRoot data-testid="sheets-server-slot-root" style={styleProps.root}>
      <ServerSlotAvatar data-testid="sheets-server-slot-avatar" style={styleProps.avatar}>
        avatar
      </ServerSlotAvatar>
    </ServerSlotRoot>
  )
}

export default function CspServerSheetsPage() {
  const styles = useStyle(sheet)
  return (
    <ServerFrame testId="page-csp-server-sheets" title="Sheets">
      <ServerCard data-testid="sheets-server-handle" style={sheet.serverCard}>
        server handle
      </ServerCard>
      <ServerSlotCard styleProps={{ root: sheet.root, avatar: [sheet.avatar] }} />
      <ClientOwnHandle />
      <ClientUseStyle />
      <ClientPicked tone="card" />
      <ClientSlot />
      <ClientCard testId="sheets-crossed-entry" entry={styles.card} />
      <ClientCard testId="sheets-crossed-object" entry={objectSheet.card} />
      <ClientCard testId="sheets-crossed-handle" entry={sheet.card} />
      <ClientClassName testId="sheets-class-name" className={String(styles.label)} />
    </ServerFrame>
  )
}
