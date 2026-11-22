'use client'

import {
  Badge,
  Button,
  Callout,
  Card,
  Heading,
  Muted,
  NavBar,
  Page,
  Panel,
  ProductGrid,
} from '@umber-fixtures/shared/components'
import { keyframes, styled } from '@umber-fixtures/shared/style'
import Link from 'next/link'
import type { ReactNode } from 'react'

// The parts of the registry pages. They are client components, as the components of a design system
// are: a server component cannot see the CacheProvider of the providers file (the server components
// build has no context), so only what renders in a client component reaches the registry.

/** The content that streams in late: a class that no other part of the first flush has. */
const LateBox = styled('aside', { name: 'RegistryLate' })(({ theme }) => ({
  borderTop: `3px dashed ${theme.palette.accent}`,
  paddingTop: theme.space[3],
}))

/** The animation of the second page only: its `@keyframes` rule comes with the page. */
const glow = keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } }, { label: 'registry-glow' })

const Glow = styled('span', { name: 'RegistryGlow' })(({ theme }) => ({
  display: 'inline-block',
  width: 12,
  height: 12,
  backgroundColor: theme.palette.primary,
  animation: `${glow} 2s ease-in-out infinite alternate`,
}))

/** The links between the pages of the registry. */
function RegistryNav() {
  return (
    <NavBar data-testid="registry-nav">
      <Link href="/registry" data-testid="link-registry">
        Registry
      </Link>
      <Link href="/registry/other" data-testid="link-registry-other">
        Other
      </Link>
      <Link href="/registry/stream" data-testid="link-registry-stream">
        Stream
      </Link>
    </NavBar>
  )
}

/** The frame of a registry page: the links, a heading, and what the page puts in it. */
export function RegistryFrame({
  testId,
  title,
  children,
}: {
  testId: string
  title: string
  children?: ReactNode
}) {
  return (
    <Page data-testid={testId}>
      <RegistryNav />
      <Heading>{title}</Heading>
      {children}
    </Page>
  )
}

/** The first page: styled components that render at once. */
export function RegistryHome() {
  return (
    <Card data-testid="registry-card">
      <Muted>Rendered at once</Muted>
      <Button data-testid="registry-button">Save</Button>
    </Card>
  )
}

/** What the stream shows until the late part arrives. */
export function StreamFallback() {
  return <Muted data-testid="registry-fallback">Loading</Muted>
}

/** The late part of the stream. */
export function LateNote() {
  return (
    <LateBox data-testid="registry-late">
      <Badge data-testid="registry-late-badge">Late</Badge>
    </LateBox>
  )
}

/** The second page: classes of its own and an animation. */
export function RegistryOther() {
  return (
    <ProductGrid data-testid="registry-grid">
      <Callout data-testid="registry-callout">Callout</Callout>
      <Glow data-testid="registry-glow" />
    </ProductGrid>
  )
}

/** One of two parts with no class in common, chosen by the query of the request. */
export function RegistryPick({ kind }: { kind: string }) {
  return kind === 'badge' ? (
    <Badge data-testid="pick-badge">Badge</Badge>
  ) : (
    <Panel data-testid="pick-panel">Panel</Panel>
  )
}
