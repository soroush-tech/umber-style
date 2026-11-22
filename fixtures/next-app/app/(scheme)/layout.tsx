import { Card, NavBar } from '@umber-fixtures/shared/components'
import { Hydrated } from '@umber-fixtures/shared/interactive'
import { Global, ThemeProvider } from '@umber-fixtures/shared/style'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { readRootScheme, ROOT_COOKIE, rootDark, rootLight } from '../scheme-themes'
import { RootSwitch } from './client'
import { rootGlobal } from './parts'

export const metadata = { title: 'UmberStyle root theme', icons: { icon: 'data:,' } }

/** The links of the routes under /s, each `link-<name>` for a page `page-<name>`. */
const LINKS = [
  ['s-home', '/s'],
  ['s-brand', '/s/brand'],
  ['s-accent', '/s/accent'],
  ['s-one', '/s/deep/one'],
  ['s-two', '/s/deep/two'],
  ['s-slow', '/s/deep/slow'],
  ['s-broken', '/s/deep/broken'],
  ['s-missing', '/s/deep/missing'],
  ['s-other', '/s/other'],
  ['s-late', '/s/stream/late'],
  ['bare', '/bare'],
  ['home', '/'],
] as const

// A root layout whose outermost provider has no `isRoot`: its theme is on `:root`, and the server chooses
// it from a cookie, which the switch changes before it asks for the page again.
export default async function SchemeLayout({ children }: { children: ReactNode }) {
  const scheme = readRootScheme((await cookies()).get(ROOT_COOKIE)?.value)
  return (
    <html lang="en">
      <body>
        <ThemeProvider theme={scheme === 'dark' ? rootDark : rootLight} colorScheme={scheme}>
          <Global styles={rootGlobal} />
          <NavBar data-testid="nav">
            {LINKS.map(([name, href]) => (
              <Link key={name} href={href} data-testid={`link-${name}`}>
                {name}
              </Link>
            ))}
            <RootSwitch scheme={scheme} />
          </NavBar>
          <Card data-testid="s-root-card">Root</Card>
          {children}
          <Hydrated />
        </ThemeProvider>
      </body>
    </html>
  )
}
