import { createElement, type ReactElement } from 'react'
import { type Cache, type Engine, type GlobalInput, type GlobalRules } from '@umber-style/core'
import { createGlobalMarker } from '@umber-style/core/internal'

/** A `<style href precedence>` element, as data: what a server component can hand to a client component. */
export interface StyleText {
  /** The `href` of the element, which React renders once however many elements name it. */
  readonly href: string
  /** The CSS text of the element. */
  readonly text: string
}

/**
 * The `<style href precedence>` elements of `texts`, in the precedence of the prefix of `cache`, with
 * `nonce` (that of the cache by default; the server build gives the request's) when there is one: React
 * keeps the rules of such an element only when its nonce is the style nonce of the render (`nonce: { style }`
 * of React's server render), and sets it on the element it makes in the browser.
 */
export function createTextElements(
  cache: Cache,
  texts: readonly StyleText[],
  nonce = cache.nonce
): ReactElement[] {
  return texts.map(({ href, text }) =>
    createElement('style', { key: href, href, precedence: cache.prefix, nonce }, text)
  )
}

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
  return collectNameTexts(cache, splitClassNames(className))
}

/** The class names in `className`, in order. */
function splitClassNames(className: string | undefined): string[] {
  return (className ?? '').split(/\s+/).filter(Boolean)
}

/** The style elements, as data, of the classes `names` (see `collectStyleTexts`). */
function collectNameTexts(cache: Cache, names: readonly string[]): StyleText[] {
  const sent = new Set<string>()
  return names.flatMap((name) => {
    const rules = cache.getFullRules(name)
    if (rules.length === 0) return []
    return [
      ...collectKeyframesTexts(cache, cache.getAnimations(name), sent),
      { href: name, text: readClassText(cache, rules) },
    ]
  })
}

/** How many entries a level of the memo of element lists holds before it is emptied: a bound on its memory. */
export const ELEMENT_LIST_LIMIT = 10_000

/** What a render of one class string made, with what each name had then: the list stands while they are the same. */
interface ElementList {
  /** The class names of the string. */
  readonly names: readonly string[]
  /** The list of full rules that `getFullRules` gave for each name. */
  readonly rules: readonly (readonly string[])[]
  /** The animation names that `getAnimations` gave for each name. */
  readonly animations: readonly (readonly string[])[]
  /** The elements made. */
  readonly elements: ReactElement[]
}

// The lists of elements of each cache, by nonce and then by class string: held weakly by the cache.
const elementLists = new WeakMap<Cache, Map<string | undefined, Map<string, ElementList>>>()

/** The value of `key` in `map`, made by `make` when there is none; the map is emptied first when it holds the limit. */
function readOrMake<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let value = map.get(key)
  if (value === undefined) {
    if (map.size >= ELEMENT_LIST_LIMIT) map.clear()
    value = make()
    map.set(key, value)
  }
  return value
}

/** Whether `now` is the list that `before` was: the same object, or both empty (the cache gives a new empty list for a name it has nothing for). */
function isSameList(now: readonly string[], before: readonly string[]): boolean {
  return now === before || (now.length === 0 && before.length === 0)
}

/** Whether each name of `known` has the rules and the animations it had when the list was made. */
function isStillSame(cache: Cache, known: ElementList): boolean {
  const { names, rules, animations } = known
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    if (!isSameList(cache.getFullRules(name), rules[index])) return false
    if (!isSameList(cache.getAnimations(name), animations[index])) return false
  }
  return true
}

/** The `<style href precedence>` elements for the classes in `className` (see `collectStyleTexts`); the precedence is the prefix of the cache, the nonce `nonce`, that of the cache by default. */
export function createStyleElements(
  cache: Cache,
  className: string | undefined,
  nonce = cache.nonce
): ReactElement[] {
  let byNonce = elementLists.get(cache)
  if (byNonce === undefined) {
    byNonce = new Map()
    elementLists.set(cache, byNonce)
  }
  const remembered = readOrMake(byNonce, nonce, () => new Map<string, ElementList>())
  const key = className ?? ''
  const known = remembered.get(key)
  if (known !== undefined && isStillSame(cache, known)) return known.elements
  const names = splitClassNames(className)
  const elements = createTextElements(cache, collectNameTexts(cache, names), nonce)
  if (remembered.size >= ELEMENT_LIST_LIMIT) remembered.clear()
  remembered.set(key, {
    names,
    rules: names.map((name) => cache.getFullRules(name)),
    animations: names.map((name) => cache.getAnimations(name)),
    elements,
  })
  return elements
}

/** The `<style href precedence>` elements of the global rules of `sets` (see `collectGlobalTexts`); the nonce is `nonce`, that of the cache by default. */
export function createGlobalElements(
  cache: Cache,
  sets: readonly GlobalRules[],
  nonce = cache.nonce
): ReactElement[] {
  return createTextElements(cache, collectGlobalTexts(cache, sets), nonce)
}

/**
 * The style elements, as data, of global rules that the cache wrote (`insertGlobal`): for each set with
 * rules, the elements of the animations it uses, then its own, with its id as `href` and the order
 * statement of the layers first. Each `href` once.
 */
export function collectGlobalTexts(cache: Cache, sets: readonly GlobalRules[]): StyleText[] {
  const sent = new Set<string>()
  return sets.flatMap(({ id, rules, animations }) => {
    if (rules.length === 0 || sent.has(id)) return []
    sent.add(id)
    return [
      ...collectKeyframesTexts(cache, animations, sent),
      { href: id, text: [cache.layerOrder, ...rules].join('') },
    ]
  })
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
