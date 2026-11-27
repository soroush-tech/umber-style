'use client'

// A namespace import: the server build of React has no hooks, and a server that loads the server build
// of this package with no bundler (which would make this module a reference) still loads this module.
import * as React from 'react'
import { findCache } from '@umber-style/core/internal'

/** The props of `GlobalRelease`: the sets of global rules that a server component wrote, by its prefix. */
export interface GlobalReleaseProps {
  /** The prefix of the cache that wrote the sets on the server. */
  prefix: string
  /** The sets, as JSON text: a list of `[id, rules]`. Text, so that the same sets in a new payload are equal and nothing is written again. */
  sets: string
}

/**
 * The browser part of the `Global` of a server component, which renders it after the style elements of
 * its sets. Those elements stay in the document for good (React keeps a style element it hoisted), so in
 * the browser this component lets the cache of the prefix take the rules over, as the `Global` of the
 * client build does with the rules a server sent: the cache deletes them from the element's style sheet
 * when this component unmounts (a client-side navigation away from the page), and writes them itself when
 * it mounts again and the element no longer has them. The text of the element keeps the rules: nothing
 * parses it again, since React neither moves nor rewrites a style element that is in the head. Where the
 * page has no cache of the prefix (no client component made one), it does nothing and the rules stay.
 */
export function GlobalRelease({ prefix, sets }: GlobalReleaseProps): null {
  React.useInsertionEffect(() => {
    const cache = findCache(prefix, document)
    if (cache === undefined) return undefined
    const parsed = JSON.parse(sets) as [id: string, rules: string[]][]
    const releases = parsed.map(([id, rules]) =>
      cache.insertGlobal({ id, rules, animations: [] }, { isRendered: true })
    )
    return () => {
      for (const release of releases) release()
    }
  }, [prefix, sets])
  return null
}
