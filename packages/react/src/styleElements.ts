import { createElement, type ReactElement } from 'react'
import {
  createGlobalMarker,
  type Cache,
  type Engine,
  type GlobalInput,
  type GlobalRules,
} from '@umber-style/core'

/** A `<style href precedence>` element, as data: what a server component can hand to a client component. */
export interface StyleText {
  /** The `href` of the element, which React renders once however many elements name it. */
  readonly href: string
  /** The CSS text of the element. */
  readonly text: string
}

/**
 * The `<style href precedence>` element of `style`, in the precedence of the prefix of `cache`, with
 * `nonce` (the nonce of the cache unless the server build gives the request's) when there is one: React
 * keeps the rules of such an element only when its nonce is the style nonce of the render (`nonce: { style }`
 * of React's server render), and sets it on the element it makes in the browser.
 */
const toElement =
  (cache: Cache, nonce: string | undefined) =>
  ({ href, text }: StyleText): ReactElement =>
    createElement('style', { key: href, href, precedence: cache.prefix, nonce }, text)

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

// The text of the style element of a class, by the rules the cache gave for it (`getFullRules`): the
// cache gives the same list while it holds the class, so a render after the first reuses the text, and
// the text goes when the cache lets the list go.
const classTexts = new WeakMap<readonly string[], string>()

/** The text of the style element of a class whose rules are `rules`: the order statement of the layers of `cache`, then the rules. */
function readClassText(cache: Cache, rules: readonly string[]): string {
  let text = classTexts.get(rules)
  if (text === undefined) {
    text = [cache.layerOrder, ...rules].join('')
    classTexts.set(rules, text)
  }
  return text
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
        { href: name, text: readClassText(cache, rules) },
      ]
    })
}

/** The `<style href precedence>` elements for the classes in `className` (see `collectStyleTexts`); the precedence is the prefix of the cache, the nonce `nonce`, that of the cache by default. */
export function createStyleElements(
  cache: Cache,
  className: string | undefined,
  nonce = cache.nonce
): ReactElement[] {
  return collectStyleTexts(cache, className).map(toElement(cache, nonce))
}

/**
 * The `<style href precedence>` elements of global rules that the cache wrote (`insertGlobal`): for each set
 * with rules, the elements of the animations it uses, then its own, with its id as `href` and the order
 * statement of the layers first. Each `href` once. The nonce is `nonce`, that of the cache by default.
 */
export function createGlobalElements(
  cache: Cache,
  sets: readonly GlobalRules[],
  nonce = cache.nonce
): ReactElement[] {
  const sent = new Set<string>()
  const texts = sets.flatMap(({ id, rules, animations }) => {
    if (rules.length === 0 || sent.has(id)) return []
    sent.add(id)
    return [
      ...collectKeyframesTexts(cache, animations, sent),
      { href: id, text: [cache.layerOrder, ...rules].join('') },
    ]
  })
  return texts.map(toElement(cache, nonce))
}

// The sets of global styles resolved by each engine, by the styles (an object, a handle, a function or a
// list) and the theme view: all three kept weakly, so the sets go with any of them.
const resolved = new WeakMap<object, WeakMap<object, WeakMap<object, GlobalRules[]>>>()

/** The map of `outer` under `key`, made empty when there is none. */
function readInner<V>(outer: WeakMap<object, V>, key: object, create: () => V): V {
  let inner = outer.get(key)
  if (inner === undefined) {
    inner = create()
    outer.set(key, inner)
  }
  return inner
}

/**
 * `engine.resolveGlobal(styles, view)`, kept for the same engine, styles and view: a server render that
 * renders `Global` again with the styles and the view of the render before gets the same sets, and a
 * function of the theme is not called again (nor the `css` template it returns read again). Styles that
 * are no object or function (nothing, `false`) are resolved each time, which costs nothing.
 */
export function readGlobalSets<T>(
  engine: Engine<T>,
  styles: GlobalInput<T>,
  view: T
): GlobalRules[] {
  if (styles === null || (typeof styles !== 'object' && typeof styles !== 'function')) {
    return engine.resolveGlobal(styles, view)
  }
  const byStyles = readInner(resolved, engine, () => new WeakMap())
  const byView = readInner(byStyles, styles, () => new WeakMap<object, GlobalRules[]>())
  return readInner(byView, view as object, () => engine.resolveGlobal(styles, view))
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
