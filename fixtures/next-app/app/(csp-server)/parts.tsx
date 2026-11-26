import Link from 'next/link'
import type { ReactNode } from 'react'
import { keyframes, styled } from './style'

// The server components of the pages under /csp-server: every class is made in the server components
// build, and each element sends the style element of its class.

const Frame = styled('main', { name: 'CspServerFrame' })(({ theme }) => ({
  padding: theme.space[3],
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
}))

const Nav = styled('nav', { name: 'CspServerNav' })(({ theme }) => ({
  display: 'flex',
  gap: theme.space[2],
  marginBottom: theme.space[3],
}))

const Title = styled('h1', { name: 'CspServerTitle' })(({ theme }) => ({
  fontSize: 24,
  color: theme.palette.primary,
}))

/** The frame of a page under /csp-server: the links, a title, and what the page puts in it. */
export function ServerFrame({
  testId,
  title,
  children,
}: {
  testId: string
  title: string
  children?: ReactNode
}) {
  return (
    <Frame data-testid={testId}>
      <Nav>
        <Link href="/csp-server" data-testid="link-csp-server">
          Home
        </Link>
        <Link href="/csp-server/other" data-testid="link-csp-server-other">
          Other
        </Link>
      </Nav>
      <Title>{title}</Title>
      {children}
    </Frame>
  )
}

/** A card of the home page. */
export const HomeCard = styled('section', { name: 'CspServerHomeCard' })(({ theme }) => ({
  paddingLeft: 16,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: theme.palette.border,
}))

const pulse = keyframes(
  { from: { opacity: 0.6 }, to: { opacity: 1 } },
  { label: 'csp-server-pulse' }
)

/**
 * A chip of the streaming page, outside its `Suspense` boundary and inside it: a base class whose
 * `paddingLeft` its props class overrides, which holds only while the base rule comes first.
 */
export const Chip = styled('span', { name: 'CspServerChip' })<{ tone: 'calm' | 'loud' }>(
  ({ theme }) => ({
    display: 'inline-block',
    paddingLeft: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.palette.border,
  }),
  ({ tone }) => ({ paddingLeft: tone === 'loud' ? 20 : 12 })
)

/** The card that streams late on the streaming page: a class that only the late chunk has. */
export const LateCard = styled('section', { name: 'CspServerLateCard' })(({ theme }) => ({
  marginTop: theme.space[2],
  paddingLeft: 28,
  borderLeftWidth: 4,
  borderLeftStyle: 'solid',
  borderLeftColor: theme.palette.primary,
}))

/** The card of the other page: classes of its own, and an animation, that the home page does not have. */
export const OtherCard = styled('section', { name: 'CspServerOtherCard' })(({ theme }) => ({
  paddingLeft: 24,
  outlineStyle: 'solid',
  outlineWidth: 3,
  outlineColor: theme.palette.accent,
  animationName: pulse,
  animationDuration: 1000,
  animationPlayState: 'paused',
}))
