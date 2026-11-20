import { NavBar } from '@umber-fixtures/shared/components'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'UmberStyle bare', icons: { icon: 'data:,' } }

// A root layout with no provider: the pages below have their own, or none.
export default function BareLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar data-testid="nav">
          <Link href="/bare" data-testid="link-bare">
            Bare
          </Link>
          <Link href="/bare/none" data-testid="link-bare-none">
            None
          </Link>
          <Link href="/s" data-testid="link-s-home">
            Root theme
          </Link>
        </NavBar>
        {children}
        <Hydrated />
      </body>
    </html>
  )
}
