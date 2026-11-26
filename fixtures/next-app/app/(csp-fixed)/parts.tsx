import Link from 'next/link'
import type { ReactNode } from 'react'
import { styled } from './style'

// The server components of the pages under /csp-fixed: every class is made in the server components
// build, and each element sends its class in place with the fixed nonce of the cache.

const Frame = styled('main', { name: 'CspFixedFrame' })(({ theme }) => ({
  padding: theme.space[3],
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
}))

const Nav = styled('nav', { name: 'CspFixedNav' })(({ theme }) => ({
  display: 'flex',
  gap: theme.space[2],
  marginBottom: theme.space[3],
}))

/** The frame of a page under /csp-fixed: the links and what the page puts in it. */
export function FixedFrame({ testId, children }: { testId: string; children?: ReactNode }) {
  return (
    <Frame data-testid={testId}>
      <Nav>
        <Link href="/csp-fixed" data-testid="link-csp-fixed">
          Home
        </Link>
        <Link href="/csp-fixed/other" data-testid="link-csp-fixed-other">
          Other
        </Link>
      </Nav>
      {children}
    </Frame>
  )
}

/** A card of the home page. */
export const HomeCard = styled('section', { name: 'CspFixedHomeCard' })(({ theme }) => ({
  paddingLeft: 16,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: theme.palette.border,
}))

/** The card of the other page, a class that only a client-side navigation to it brings. */
export const OtherCard = styled('section', { name: 'CspFixedOtherCard' })(({ theme }) => ({
  paddingLeft: 24,
  outlineStyle: 'solid',
  outlineWidth: 3,
  outlineColor: theme.palette.accent,
}))
