import {
  createElement,
  Fragment,
  useInsertionEffect,
  useMemo,
  useRef,
  type ReactElement,
} from 'react'
import type { Engine, GlobalRules } from '@umber-style/core'
import type { GlobalProps } from './types'

/** What is released while nothing is written. */
function releaseNothing(): void {}

/** Writes `sets` into the cache of `engine`, in order, and returns the function that releases them all. */
function insertSets<T>(engine: Engine<T>, sets: readonly GlobalRules[]): () => void {
  const releases = sets.map((set) => engine.cache.insertGlobal(set))
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
 * runs and nothing unmounts, so the rules are written for good, during the render, and the style
 * elements that `createGlobalElements` gives are rendered.
 */
export function createGlobal<T>(
  engine: Engine<T>,
  useThemeView: () => T,
  createGlobalElements: (sets: readonly GlobalRules[]) => ReactElement[]
) {
  return function Global({ styles }: GlobalProps<T>): ReactElement | null {
    const view = useThemeView()
    const sets = useMemo(() => engine.resolveGlobal(styles, view), [styles, view])
    // The release of the rules in the page: the new ones are written before the old ones are released.
    const held = useRef(releaseNothing)
    useInsertionEffect(() => {
      const previous = held.current
      held.current = insertSets(engine, sets)
      previous()
    }, [sets])
    useInsertionEffect(
      () => () => {
        held.current()
        held.current = releaseNothing
      },
      []
    )
    if (typeof document !== 'undefined') return null
    insertSets(engine, sets)
    const elements = createGlobalElements(sets)
    return elements.length === 0 ? null : createElement(Fragment, null, ...elements)
  }
}
