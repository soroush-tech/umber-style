import { NextResponse, type NextRequest } from 'next/server'

// The routes under /ppr-csp are sent with a strict content security policy, as in the App Router fixture
// (fixtures/next-app/proxy.ts): a new nonce for each request, in the policy of the response and in the
// request headers that the render reads (`Content-Security-Policy` for the framework, `x-nonce` for the
// nonce source). `?control=no-policy` sends the same page with no policy and no nonce.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-nonce')
  if (request.nextUrl.searchParams.get('control') === 'no-policy') {
    requestHeaders.delete('content-security-policy')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const evaluation = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  const policy = `style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evaluation}`
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', policy)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', policy)
  return response
}

export const config = { matcher: ['/ppr-csp', '/ppr-csp/:path*'] }
