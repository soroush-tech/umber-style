import { readSharedState } from './sharedState'

/**
 * Where the nonce of a request comes from: a function the app gives once, which the server components
 * build of the React binding calls once in each request. It may answer at once or with a Promise.
 */
export type NonceSource = () => string | undefined | Promise<string | undefined>

// The source of every copy of the packages in the program: an app registers it once, in any module, and
// the binding of another copy reads it.
const registered = readSharedState('core.nonce-source@1', () => ({
  source: undefined as NonceSource | undefined,
}))

/**
 * Registers where the nonce of a request comes from, for the style elements of the server components
 * build of the React binding: in each request it calls `source` once (a Promise is awaited), and every
 * style element that request renders carries the answer, in place of the nonce of the cache. Call it once,
 * at the top of a module of the app, as `setNonceSource(async () => (await headers()).get('x-nonce') ??
 * undefined)` does in a Next.js app. `undefined` takes the registration back. Where no server components
 * render (a browser, a classic server render, Vue, React Native) nothing reads it.
 */
export function setNonceSource(source: NonceSource | undefined): void {
  registered.source = source
}

/** The source of the nonce of a request that the app registered with `setNonceSource`, or undefined. */
export function readNonceSource(): NonceSource | undefined {
  return registered.source
}
