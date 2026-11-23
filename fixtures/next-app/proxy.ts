import { NextResponse, type NextRequest } from 'next/server'

// The routes under /csp are sent with a strict content security policy, as the framework's guide sets
// one (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md): a new nonce for each
// request, in the policy of the response and in the request headers that the render reads. The
// framework takes the nonce of its own scripts, and the style nonce of React's render, from the
// `Content-Security-Policy` header of the request; the layout reads `x-nonce`. Styles have no
// 'unsafe-inline'. The development server needs 'unsafe-eval' for React's debugging.
//
// Two switches of the query, for the tests: `?control=no-policy` sends the same page with no policy and
// no nonce (what the styles are compared with), and `?control=no-cache-nonce` keeps the policy and
// leaves the nonce off the cache (the negative control).
export function proxy(request: NextRequest) {
  const control = request.nextUrl.searchParams.get('control')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-nonce')
  requestHeaders.delete('x-csp-control')
  if (control === 'no-policy') {
    requestHeaders.delete('content-security-policy')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDevelopment = process.env.NODE_ENV === 'development'
  const evaluation = isDevelopment ? " 'unsafe-eval'" : ''
  const policy = `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', policy)
  if (control === 'no-cache-nonce') requestHeaders.set('x-csp-control', control)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', policy)
  return response
}

export const config = { matcher: ['/csp', '/csp/:path*'] }
