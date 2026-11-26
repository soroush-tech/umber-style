import Link from 'next/link'
import type { ReactNode } from 'react'
import { keyframes, styled } from './style'

// The server components of the pages under /csp-server, and of /csp-inplace, which renders the same
// parts with no registry: every class is made in the server components build, and each element sends the
// style of its class.

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

/** The frame of a page under `base` (/csp-server by default): the links, a title, and what the page puts in it. */
export function ServerFrame({
  testId,
  title,
  base = '/csp-server',
  children,
}: {
  testId: string
  title: string
  base?: string
  children?: ReactNode
}) {
  return (
    <Frame data-testid={testId}>
      <Nav>
        <Link href={base} data-testid="link-csp-server">
          Home
        </Link>
        <Link href={`${base}/other`} data-testid="link-csp-server-other">
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

/** A list whose items are styled by their place in it. */
export const List = styled('ul', { name: 'CspServerList' })({
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

/**
 * An item whose look depends on its place: `:first-child`, `:nth-child(2)` and `& + &`. A style element
 * among the items would shift all three.
 */
export const Item = styled('li', { name: 'CspServerItem' })(({ theme }) => ({
  color: theme.palette.text,
  marginTop: 1,
  '&:first-child': { color: theme.palette.accent },
  '&:nth-child(2)': { color: theme.palette.primary },
  '& + &': { marginTop: 9 },
}))

/** A tag shown first in the fallback of a boundary, then in the content that replaces it. */
export const Tag = styled('em', { name: 'CspServerTag' })(({ theme }) => ({
  color: theme.palette.primary,
  paddingLeft: 5,
}))

/** Holds a nested boundary of the streaming page. */
export const Box = styled('div', { name: 'CspServerBox' })({
  outlineStyle: 'solid',
  outlineWidth: 3,
})

/**
 * A pill: a base class whose `paddingLeft` its props class overrides. The streaming page uses it first
 * inside a boundary; the other page brings a props class of its own, which a client-side navigation writes
 * after the base class.
 */
export const Pill = styled('span', { name: 'CspServerPill' })<{ size: 'small' | 'big' }>(
  { display: 'inline-block', paddingLeft: 8, borderStyle: 'dotted', borderWidth: 1 },
  ({ size }) => ({ paddingLeft: size === 'big' ? 30 : 12 })
)

/** Waits `ms`, then renders its children: an async server component, which suspends. */
export async function Late({ ms, children }: { ms: number; children: ReactNode }) {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return <>{children}</>
}
