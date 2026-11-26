import {
  createElement,
  Fragment,
  useInsertionEffect,
  useMemo,
  useRef,
  type ReactElement,
} from 'react'
import type { Cache, Engine, GlobalRules } from '@umber-style/core'
import { useProvidedCache } from './CacheProvider'
import { readGlobalSets } from './styleElements'
import { useStyleRegistry, type StyleRegistryStore } from './styleRegistry'
import type { GlobalProps } from './types'

/** What is released while nothing is written. */
function releaseNothing(): void {
  // Nothing was written, so there is nothing to release.
}

/** Writes `sets` into the cache of `engine`, in order, as rules that a component rendered, and returns the function that releases them all. */
function insertSets<T>(engine: Engine<T>, sets: readonly GlobalRules[]): () => void {
  const releases = sets.map((set) => engine.cache.insertGlobal(set, { isRendered: true }))
  return () => {
    for (const release of releases) release()
  }
}

/**
 * Makes `Global` over an engine: it reads the view of the theme of the nearest provider through
 * `useThemeView` (references for tokens, real values for raw keys) and writes the rules of its styles into the cache.
 * In the browser an insertion effect writes them, before the page changes, and releases them when it
 * unmounts; when the rules change it writes the new ones first and then releases the old ones, so that
 * there is no moment with neither. The cache counts the rules of each set: two elements with equal
 * styles share them, and an effect that runs twice in development writes them back. Rules that a server
 * render sent are taken over, not written again. Where there is no document (a server render) no effect
 * runs and nothing unmounts, so the rules are written for good, during the render, and the elements that
 * `createServerElements` gives for the sets are rendered: the style elements of the sets, or the marker
 * that names them (under a `CacheProvider`, `cache`, and without style elements), so that the CSS
 * extracted for the page holds them and the CSS of another page does not; none under a `StyleRegistry`
 * (`registry`), which takes their texts.
 */
export function createGlobal<T>(
  engine: Engine<T>,
  useThemeView: (cache?: Cache) => T,
  createServerElements: (
    sets: readonly GlobalRules[],
    cache: Cache | undefined,
    registry: StyleRegistryStore | undefined
  ) => ReactElement[]
) {
  return function Global({ styles }: GlobalProps<T>): ReactElement | null {
    const cache = useProvidedCache()
    const registry = useStyleRegistry()
    const local = cache === undefined ? engine : engine.withCache(cache)
    const view = useThemeView(cache)
    // Where there is no document (a server render) the sets of the render before are taken again for
    // the same styles and view; in the browser the memo of the component keeps them.
    const sets = useMemo(
      () =>
        typeof document === 'undefined'
          ? readGlobalSets(local, styles, view)
          : local.resolveGlobal(styles, view),
      [local, styles, view]
    )
    // The release of the rules in the page: the new ones are written before the old ones are released.
    const held = useRef(releaseNothing)
    useInsertionEffect(() => {
      const previous = held.current
      held.current = insertSets(local, sets)
      previous()
    }, [local, sets])
    useInsertionEffect(
      () => () => {
        held.current()
        held.current = releaseNothing
      },
      []
    )
    if (typeof document !== 'undefined') return null
    insertSets(local, sets)
    const elements = createServerElements(sets, cache, registry)
    return elements.length === 0 ? null : createElement(Fragment, null, ...elements)
  }
}
