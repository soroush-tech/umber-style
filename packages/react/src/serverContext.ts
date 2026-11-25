import { cache as reactCache } from 'react'
import { readNonceSource } from '@umber-style/core'

/** The state of one request: the value, and whether a provider has written it. */
export interface ServerSlot<T> {
  /** The value of the request, the default until a provider writes it. */
  current: T
  /** Whether a provider has written `current` in this request. */
  isSet: boolean
}

/** What makes the slot of a request: `React.cache`, or a function with the same contract. */
export type CacheFunction = <R>(make: () => R) => () => R

/**
 * The slot of the current request, for server components, which have no React context: `React.cache`
 * keeps it for the length of one request, starting at `defaultValue`. It is never shared between two
 * requests, so nothing written there depends on the order in which requests come.
 */
export function createRequestSlot<T>(
  defaultValue: T,
  cache: CacheFunction = reactCache
): () => ServerSlot<T> {
  return cache((): ServerSlot<T> => ({ current: defaultValue, isSet: false }))
}

/** The nonce of a request as the server build holds it: known, or a Promise while the source has not answered. */
export type RequestNonce = string | undefined | Promise<string | undefined>

/** What the nonce of one request is: the answer of the source once it came, or the Promise of it before. */
interface NonceSlot {
  known?: { value: string | undefined }
  pending?: Promise<string | undefined>
}

/** Whether `value` is a Promise, or anything else with a `then`. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | undefined)?.then === 'function'
}

/**
 * The function that gives the nonce of the current request for the style elements of the server build.
 * With no source registered (`setNonceSource`) it is `fallback()`, the nonce of the cache, as it always
 * was. With one, the source is called once in each request (the slot of `cache`, `React.cache` unless a
 * test gives one) and its answer is the nonce, or `fallback()` when it answers `undefined`; while a Promise
 * it returned has not settled, the reader gives that Promise, which a component awaits, and once it has,
 * the value itself, so that no component waits after the first ones.
 */
export function createNonceReader(
  fallback: () => string | undefined,
  cache: CacheFunction = reactCache
): () => RequestNonce {
  const readSlot = cache((): NonceSlot => ({}))
  return () => {
    const source = readNonceSource()
    if (source === undefined) return fallback()
    const slot = readSlot()
    if (slot.known !== undefined) return slot.known.value
    if (slot.pending !== undefined) return slot.pending
    const answer = source()
    if (!isThenable(answer)) {
      slot.known = { value: answer ?? fallback() }
      return slot.known.value
    }
    slot.pending = Promise.resolve(answer).then((value) => {
      slot.known = { value: value ?? fallback() }
      return slot.known.value
    })
    return slot.pending
  }
}

/** `render` of the nonce that `nonce` holds: at once when it is known, else once its Promise settles. */
export function withNonce<R>(
  nonce: RequestNonce,
  render: (value: string | undefined) => R
): R | Promise<R> {
  return isThenable(nonce) ? nonce.then(render) : render(nonce)
}
