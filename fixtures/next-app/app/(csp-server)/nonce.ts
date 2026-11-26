import { setNonceSource } from '@umber-style/react'
import { headers } from 'next/headers'

// Where the nonce of a request comes from, registered once at the top of a module, as an app does: the
// `x-nonce` header that proxy.ts set. The server components build calls it once in each request, also in
// the request of a client-side navigation, which renders only the page and not this layout's provider.
// The negative control of the tests (`?control=no-source`) makes it give nothing, which is what a page
// with no source registered gets.
setNonceSource(async () => {
  const requestHeaders = await headers()
  if (requestHeaders.get('x-csp-control') === 'no-source') return undefined
  return requestHeaders.get('x-nonce') ?? undefined
})
