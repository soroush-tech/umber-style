import { NextResponse, type NextRequest } from 'next/server'
import { FIXED_NONCE } from './app/(csp-fixed)/nonce'

// The routes under /csp are sent with a strict content security policy, as the framework's guide sets
// one (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md): a new nonce for each
// request, in the policy of the response and in the request headers that the render reads. The
// framework takes the nonce of its own scripts from the `Content-Security-Policy` header of the request
// (it gives React's render that nonce as a string, which React takes as the script nonce only); the
// layouts read `x-nonce`. Styles have no 'unsafe-inline'. The development server needs 'unsafe-eval'
// for React's debugging.
//
// Three switches of the query, for the tests: `?control=no-policy` sends the same page with no policy and
// no nonce (what the styles are compared with), `?control=no-cache-nonce` keeps the policy and leaves the
// nonce off the cache (the negative control of /csp), and `?control=no-source` keeps the policy and makes
// the nonce source of /csp-server give nothing (its negative control). A `csp-control` cookie of the same
// value does the same for every request of the page. /csp-server is sent the same way. /csp-fixed is sent
// with the same nonce in every response (the fixed nonce that its engine's cache has) and no `x-nonce`
// request header, so the nonce source of /csp-server answers nothing there. /csp-inplace is sent as
// /csp-server is: the same parts with no registry.
export function proxy(request: NextRequest) {
  // The cookie keeps a switch for the requests of the client-side navigations of a page too.
  const control =
    request.nextUrl.searchParams.get('control') ?? request.cookies.get('csp-control')?.value
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-nonce')
  requestHeaders.delete('x-csp-control')
  if (control === 'no-policy') {
    requestHeaders.delete('content-security-policy')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const isFixed = request.nextUrl.pathname.startsWith('/csp-fixed')
  const nonce = isFixed ? FIXED_NONCE : Buffer.from(crypto.randomUUID()).toString('base64')
  const isDevelopment = process.env.NODE_ENV === 'development'
  const evaluation = isDevelopment ? " 'unsafe-eval'" : ''
  const policy = `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`
  if (!isFixed) requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', policy)
  if (control === 'no-cache-nonce' || control === 'no-source') {
    requestHeaders.set('x-csp-control', control)
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', policy)
  return response
}

export const config = {
  matcher: [
    '/csp',
    '/csp/:path*',
    '/csp-server',
    '/csp-server/:path*',
    '/csp-inplace',
    '/csp-inplace/:path*',
    '/csp-fixed',
    '/csp-fixed/:path*',
  ],
}
