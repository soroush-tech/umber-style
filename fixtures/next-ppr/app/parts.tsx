import { connection } from 'next/server'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { styled } from './style'

// The server components of the pages. Everything outside a `Suspense` boundary that waits for the request
// is in the static shell, prerendered at build time; `Late` waits for the request (`connection()`), so
// what it renders streams in at request time, with classes that the shell does not have.

const Frame = styled('main', { name: 'PprFrame' })(({ theme }) => ({
  padding: theme.space[3],
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
}))

const Nav = styled('nav', { name: 'PprNav' })(({ theme }) => ({
  display: 'flex',
  gap: theme.space[2],
  marginBottom: theme.space[3],
}))

const Title = styled('h1', { name: 'PprTitle' })(({ theme }) => ({
  fontSize: 24,
  color: theme.palette.primary,
}))

/** The frame of a page under `base` (/ppr or /ppr-csp): the links, a title, and what the page puts in it. */
export function PprFrame({
  testId,
  title,
  base,
  children,
}: {
  testId: string
  title: string
  base: string
  children?: ReactNode
}) {
  return (
    <Frame data-testid={testId}>
      <Nav>
        <Link href={base} data-testid="link-ppr-home">
          Home
        </Link>
        <Link href={`${base}/other`} data-testid="link-ppr-other">
          Other
        </Link>
      </Nav>
      <Title>{title}</Title>
      {children}
    </Frame>
  )
}

/** A card of the static shell. */
export const ShellCard = styled('section', { name: 'PprShellCard' })(({ theme }) => ({
  paddingLeft: 16,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: theme.palette.border,
}))

/** What the shell shows until the late part streams in. */
export const Fallback = styled('p', { name: 'PprFallback' })(({ theme }) => ({
  paddingLeft: 10,
  color: theme.palette.muted,
}))

/** The card of the late part: a class that only the part streamed at request time has. */
export const LateCard = styled('section', { name: 'PprLateCard' })(({ theme }) => ({
  marginTop: theme.space[2],
  paddingLeft: 28,
  borderLeftWidth: 4,
  borderLeftStyle: 'solid',
  borderLeftColor: theme.palette.primary,
}))

/** The card of the other page: a class the home page does not have. */
export const OtherCard = styled('section', { name: 'PprOtherCard' })(({ theme }) => ({
  paddingLeft: 24,
  outlineStyle: 'solid',
  outlineWidth: 3,
  outlineColor: theme.palette.accent,
}))

/** Waits for the request, then `ms`, then renders its children: what it renders is never in the shell. */
export async function Late({ ms, children }: { ms: number; children: ReactNode }) {
  await connection()
  await new Promise((resolve) => setTimeout(resolve, ms))
  return <>{children}</>
}
