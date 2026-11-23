import { Hydrated } from '@umber-fixtures/shared/interactive'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import Providers from './providers'

export const metadata = { title: 'UmberStyle registry with a nonce', icons: { icon: 'data:,' } }

// A root layout of its own for the routes under /csp, which proxy.ts sends with a strict policy. It is a
// server component: it reads the nonce of the request from the `x-nonce` header that the proxy set and
// gives it to the providers file as a prop, the one way a value of the request reaches a client
// component. Reading the headers makes every page under it render for each request, which a nonce needs.
export default async function CspLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers()
  const nonce = requestHeaders.get('x-nonce') ?? undefined
  // The negative control of the tests (`?control=no-cache-nonce`): the policy stays, the cache gets no nonce.
  const isCacheWithout = requestHeaders.get('x-csp-control') === 'no-cache-nonce'
  return (
    <html lang="en">
      <body>
        <Providers nonce={isCacheWithout ? undefined : nonce}>{children}</Providers>
        <Hydrated />
      </body>
    </html>
  )
}
