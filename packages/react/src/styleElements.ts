import { createElement, type ReactElement } from 'react'
import { createGlobalMarker, type Cache, type GlobalRules } from '@umber-style/core'

/** A `<style href precedence>` element, as data: what a server component can hand to a client component. */
export interface StyleText {
  readonly href: string
  readonly text: string
}

/** The `<style href precedence>` element of `style`, in the precedence of the prefix of `cache`. */
const toElement =
  (cache: Cache) =>
  ({ href, text }: StyleText): ReactElement =>
    createElement('style', { key: href, href, precedence: cache.prefix }, text)

/**
 * The style elements of the animations in `names` that `sent` does not hold yet, which it adds them to:
 * the `@keyframes` rule that the cache wrote, with the animation name as `href`, so that React sends an
 * animation that many classes use once. The rule is outside every layer, so the element needs no order
 * statement.
 */
function collectKeyframesTexts(
  cache: Cache,
  names: readonly string[],
  sent: Set<string>
): StyleText[] {
  const texts: StyleText[] = []
  for (const name of names) {
    if (sent.has(name)) continue
    sent.add(name)
    texts.push({ href: name, text: cache.getRules(name).join('') })
  }
  return texts
}

/**
 * The style elements, as data, of the classes in `className`: React 19 moves them to the head and renders
 * each `href` once. Each one starts with the order statement of the layers (none without layers), so
 * that it is right on its own: declaring a layer again does not change the order. A name that the cache
 * made no rules for (a class of someone else) gets none. A theme class comes with every variable it has,
 * used or not: its element is sent before the elements that use them, so it cannot know which are used. A
 * class that uses animations comes after the element of each of them, once.
 */
export function collectStyleTexts(cache: Cache, className: string | undefined): StyleText[] {
  const sent = new Set<string>()
  return (className ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((name) => {
      const rules = cache.getFullRules(name)
      if (rules.length === 0) return []
      return [
        ...collectKeyframesTexts(cache, cache.getAnimations(name), sent),
        { href: name, text: [cache.layerOrder, ...rules].join('') },
      ]
    })
}

/** The `<style href precedence>` elements for the classes in `className` (see `collectStyleTexts`); the precedence is the prefix of the cache. */
export function createStyleElements(cache: Cache, className: string | undefined): ReactElement[] {
  return collectStyleTexts(cache, className).map(toElement(cache))
}

/**
 * The `<style href precedence>` elements of global rules that the cache wrote (`insertGlobal`): for each set
 * with rules, the elements of the animations it uses, then its own, with its id as `href` and the order
 * statement of the layers first. Each `href` once.
 */
export function createGlobalElements(cache: Cache, sets: readonly GlobalRules[]): ReactElement[] {
  const sent = new Set<string>()
  const texts = sets.flatMap(({ id, rules, animations }) => {
    if (rules.length === 0 || sent.has(id)) return []
    sent.add(id)
    return [
      ...collectKeyframesTexts(cache, animations, sent),
      { href: id, text: [cache.layerOrder, ...rules].join('') },
    ]
  })
  return texts.map(toElement(cache))
}

/**
 * The marker of global rules that a server render sends in place of their style elements (none is sent
 * under a cache provider, or without `hasServerStyleElements`): a `<meta name="<prefix>-global">` whose
 * `content` is the ids of the sets that have rules. React moves it to the head, and `extractPageStyles`
 * reads it, so that the CSS of this page holds the sets and the CSS of another page does not. Like the
 * stamp, it is rendered where there is no document only; a hydration skips it. None when no set has rules.
 */
export function createGlobalMarkerElements(
  cache: Cache,
  sets: readonly GlobalRules[]
): ReactElement[] {
  const marker = createGlobalMarker(cache.prefix, sets)
  if (marker === undefined) return []
  return [createElement('meta', { key: marker.name, name: marker.name, content: marker.ids })]
}

/**
 * The element that carries the options of the cache, for the browser to compare with its own: a `<meta>`
 * named `<prefix>-options`, which React moves to the head. It is not a style element, because a server
 * render merges the style elements of one precedence into one and keeps the attributes of none of them.
 */
export function createStampElement(cache: Cache): ReactElement {
  return createElement('meta', {
    key: `${cache.prefix}-options`,
    name: `${cache.prefix}-options`,
    content: cache.fingerprint,
  })
}
