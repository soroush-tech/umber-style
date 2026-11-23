'use client'

import { Heading, NavBar, Page } from '@umber-fixtures/shared/components'
import Link from 'next/link'
import type { ReactNode } from 'react'

// The frame of the pages under /csp: the parts of the registry pages, with links of their own.

/** The links between the pages under /csp. */
function CspNav() {
  return (
    <NavBar data-testid="csp-nav">
      <Link href="/csp" data-testid="link-csp">
        Home
      </Link>
      <Link href="/csp/other" data-testid="link-csp-other">
        Other
      </Link>
      <Link href="/csp/stream" data-testid="link-csp-stream">
        Stream
      </Link>
    </NavBar>
  )
}

/** The frame of a page under /csp: the links, a heading, and what the page puts in it. */
export function CspFrame({
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
      <CspNav />
      <Heading>{title}</Heading>
      {children}
    </Page>
  )
}
