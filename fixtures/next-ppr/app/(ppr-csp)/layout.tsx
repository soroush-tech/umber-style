import { Hydrated } from '@umber-fixtures/shared/interactive'
import { headers } from 'next/headers'
import { Suspense, type ReactNode } from 'react'
import { NonceProviders } from './providers'

export const metadata = {
  title: 'UmberStyle partial prerendering with a nonce',
  icons: { icon: 'data:,' },
}

/** Reads the nonce of the request, which waits for the request, and gives it to the providers file. */
async function Nonced({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return <NonceProviders nonce={nonce}>{children}</NonceProviders>
}

// The root layout of /ppr-csp, which proxy.ts sends with a strict policy and a new nonce for each request:
// the cache design of the App Router fixture (`fixtures/next-app/app/(csp)`), a cache with the nonce of the
// request given to `StyleRegistry`, and client components only. Under partial prerendering the read of the
// nonce must be inside a `Suspense` boundary: the static shell holds the document, and everything styled
// streams at request time. The nonce source of server components (`setNonceSource`) is not used: it is one
// for the whole server, and under partial prerendering it would make every route of the app wait for the
// request, the shared pages included (see docs/server-rendering.md, Limits).
export default function PprCspLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <Nonced>{children}</Nonced>
        </Suspense>
        <Hydrated />
      </body>
    </html>
  )
}
