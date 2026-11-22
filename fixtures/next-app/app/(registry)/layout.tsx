import { Hydrated } from '@umber-fixtures/shared/interactive'
import type { ReactNode } from 'react'
import Providers from './providers'

export const metadata = { title: 'UmberStyle registry', icons: { icon: 'data:,' } }

// A root layout of its own, as an app has it: a server component with no theme class on <html>, and
// the registry of the providers file around the pages.
export default function RegistryLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Hydrated />
      </body>
    </html>
  )
}
