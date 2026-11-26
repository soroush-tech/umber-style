import { cache as reactCache, createElement, type ReactElement } from 'react'
import type { Cache } from '@umber-style/core'
import { NonceStyles } from './NonceStyles'
import type { CacheFunction } from './serverContext'
import { createTextElements, type StyleText } from './styleElements'

/**
 * Whether the style texts of the current request go to `NonceStyles`: the request has a nonce, the answer
 * of the source an app registered (`setNonceSource`) or else the cache's. A server components framework may
 * give React the nonce as the script nonce only, so a request with a nonce never gets the elements React
 * hoists; a request with no nonce at all keeps the elements of 0.6.0.
 */
export function isInlineMode(nonce: string | undefined): boolean {
  return nonce !== undefined
}

/** The elements of the style texts of one component of the server build, with the nonce of the current request. */
export type StyleSender = (texts: readonly StyleText[], nonce: string | undefined) => ReactElement[]

/**
 * Makes what the components of the server build over `engineCache` send their style texts with. Outside
 * inline mode (`isInlineMode`) they are the `<style href precedence nonce>` elements that React hoists, as
 * in 0.6.0. In inline mode they are one `NonceStyles` element with every text of the component in order,
 * which shows in place in the first HTML only the texts that no component of the request showed before:
 * `cache` (`React.cache` unless a test gives one) keeps the `href` of those for the length of the request,
 * in the order the request renders its components. None when the component has no text.
 */
export function createStyleSender(
  engineCache: Cache,
  cache: CacheFunction = reactCache
): StyleSender {
  const readShown = cache(() => new Set<string>())
  return (texts, nonce) => {
    if (!isInlineMode(nonce)) return createTextElements(engineCache, texts, nonce)
    if (texts.length === 0) return []
    const shown = readShown()
    const fresh = texts.filter(({ href }) => !shown.has(href)).map(({ href }) => href)
    for (const href of fresh) shown.add(href)
    return [
      createElement(NonceStyles, {
        key: 'nonce-styles',
        prefix: engineCache.prefix,
        texts,
        ...(fresh.length < texts.length && { shown: fresh }),
        nonce,
      }),
    ]
  }
}
