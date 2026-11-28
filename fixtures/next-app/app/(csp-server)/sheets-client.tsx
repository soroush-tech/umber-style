'use client'

import type { SheetStyleProp } from '@umber-style/react'
import { sheet } from './sheets'
import { styled, useStyle } from './style'

// The client components of /csp-server/sheets. The supported way: a client component imports the sheet
// and is given a plain value by the server component, which chooses the style. And the case that is not
// supported: a style passed from a server component to a client component as a prop, whose CSS does not
// cross, so the card is unstyled (with a warning in development).

const Card = styled('section', { name: 'CspServerSheetCard' })({ display: 'block', marginTop: 2 })

const SlotRoot = styled('section', { name: 'CspServerClientSlot' })({ display: 'block' })

const SlotAvatar = styled('span', { name: 'CspServerClientSlot', slot: 'avatar' })({
  display: 'inline-block',
})

/** A card given its style by the server component that renders it: not supported, it is unstyled. */
export function ClientCard({ testId, entry }: { testId: string; entry: SheetStyleProp }) {
  return (
    <Card data-testid={testId} style={entry}>
      {testId}
    </Card>
  )
}

/** A card given a handle of the sheet that this client component imports itself. */
export function ClientOwnHandle() {
  return (
    <Card data-testid="sheets-client-handle" style={sheet.card}>
      client handle
    </Card>
  )
}

/** A card given the entry of `useStyle`, as before. */
export function ClientUseStyle() {
  const styles = useStyle(sheet)
  return (
    <Card data-testid="sheets-client-use-style" style={styles.card}>
      client useStyle
    </Card>
  )
}

/** A card whose style the server component chooses with a plain value: the way to do it. */
export function ClientPicked({ tone }: { tone: 'card' | 'label' }) {
  return (
    <Card data-testid="sheets-client-picked" style={sheet[tone]}>
      picked
    </Card>
  )
}

/** A card given a class name: the text of an entry, which carries no rule. */
export function ClientClassName({ testId, className }: { testId: string; className: string }) {
  return (
    <Card data-testid={testId} className={className}>
      class name
    </Card>
  )
}

/** A component of parts, each styled, given the style of each part by its client parent. */
function SlotCard({
  styleProps = {},
}: {
  styleProps?: { root?: SheetStyleProp; avatar?: SheetStyleProp }
}) {
  return (
    <SlotRoot data-testid="sheets-client-slot-root" style={styleProps.root}>
      <SlotAvatar data-testid="sheets-client-slot-avatar" style={styleProps.avatar}>
        avatar
      </SlotAvatar>
    </SlotRoot>
  )
}

/** The slot pattern within the client: a client component passes handles to the parts of its child, the same entries as the server's slots, so each class is written by both sides. */
export function ClientSlot() {
  return <SlotCard styleProps={{ root: sheet.root, avatar: [sheet.avatar] }} />
}
