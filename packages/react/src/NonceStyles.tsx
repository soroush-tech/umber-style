'use client'

// A namespace import: the server build of React has no hooks, and a server that loads the server build of
// this package with no bundler (which would make this module a reference) still loads this module. So
// nothing here calls React when the module loads.
import * as React from 'react'
import type { StyleText } from './styleElements'

/** The props of `NonceStyles`: the style texts of one component of the server build, as data. */
export interface NonceStylesProps {
  /** The prefix of the engine's cache: the precedence of the elements written into the head. */
  readonly prefix: string
  /** Every style text the component needs, in order. */
  readonly texts: readonly StyleText[]
  /** The `href` of the texts that the first HTML shows in place: the others were shown earlier in the request. All when absent. */
  readonly shown?: readonly string[]
  /** The nonce of the request that rendered the component. */
  readonly nonce?: string
}

// The elements of the head that hold a text, by `href`: each one this module wrote (once, even when the
// policy refused it, so a refused one is not written again and again), and each one of the page it found
// applied.
const held = new Map<string, HTMLStyleElement>()
// The nonce of the document, from the props of the first element hydrated: they came with the payload of
// the document's own request.
let recordedNonce: string | undefined

/** Keeps `nonce` as the nonce of the document, unless one is kept already. */
function recordDocumentNonce(nonce: string | undefined): void {
  recordedNonce ??= nonce
}

/**
 * The nonce that the elements written into the head of `page` carry: the one recorded at hydration, else
 * the `.nonce` of a style element that the policy let in (it has a sheet), else that of a script.
 * Undefined when none is found, and then nothing is written. A nonce read from the page can only make the
 * elements written with it refused when it is wrong: it never lets in what the policy refuses.
 */
export function readDocumentNonce(page: Document): string | undefined {
  if (recordedNonce !== undefined) return recordedNonce
  for (const element of page.querySelectorAll<HTMLStyleElement>('style[nonce]')) {
    if (element.sheet !== null && element.nonce) return element.nonce
  }
  return page.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || undefined
}

/**
 * An element of the head of `page` that holds `href` and that the policy let in (it has a sheet): React's
 * own, or one of this module. An element with no sheet holds no rule, so it never stands for one.
 */
function findApplied(page: Document, href: string): HTMLStyleElement | undefined {
  for (const element of page.head.querySelectorAll<HTMLStyleElement>('style[data-href]')) {
    if (element.sheet !== null && element.dataset.href?.split(' ').includes(href)) return element
  }
  return undefined
}

/**
 * Writes each of `texts` that the head of `page` does not hold yet into an element of its own, in the form
 * React gives a `<style href precedence>` element (`data-precedence`, `data-href`), with `nonce`, after the
 * last element of `prefix`: the order of first use. The text comes from the props, never from an element
 * of the page.
 */
function writeTexts(page: Document, prefix: string, texts: readonly StyleText[], nonce: string) {
  for (const { href, text } of texts) {
    if (held.get(href)?.isConnected) continue
    const found = findApplied(page, href)
    if (found !== undefined) {
      held.set(href, found)
      continue
    }
    const element = page.createElement('style')
    element.setAttribute('nonce', nonce)
    element.dataset.precedence = prefix
    element.dataset.href = href
    element.textContent = text
    const last = [...page.head.querySelectorAll<HTMLStyleElement>('style[data-precedence]')]
      .filter(({ dataset }) => dataset.precedence === prefix)
      .at(-1)
    if (last === undefined) page.head.append(element)
    else last.after(element)
    held.set(href, element)
  }
}

/** Whether the head holds every one of `texts` in an element the policy let in. */
const isEveryApplied = (texts: readonly StyleText[]) =>
  texts.every(({ href }) => (held.get(href)?.sheet ?? null) !== null)

// The store that `useSyncExternalStore` reads changes only in the commit of the component that reads it,
// which React checks after a hydration: there is nothing to subscribe to.
const subscribe = () => () => undefined
const isServerRender = () => true
const isBrowserRender = () => false
// The first HTML has handed nothing to the head.
const isNothingHanded = () => false

/**
 * The style texts of a component of the server build in a request with a nonce, from a nonce source or the cache.
 *
 * - In the first HTML (the server render, and its hydration) it is a `<style nonce>` in place, which React
 *   does not hoist, so it keeps its nonce: the policy lets it in with no script. At hydration it writes
 *   its texts into elements of the head with the document's nonce, then renders nothing, so the element
 *   in place goes. When the head cannot hold them (no nonce found, or the policy refused what was
 *   written), the element in place stays.
 * - Mounted after the first HTML (a client-side navigation) it renders nothing, so no element with the
 *   nonce of the navigation's request is inserted, and writes its texts into the head with the document's
 *   nonce before the browser paints.
 */
export function NonceStyles({
  prefix,
  texts,
  shown,
  nonce,
}: NonceStylesProps): React.ReactElement | null {
  // True on the server and in a hydration, false in a render of the browser that is not one; kept from the
  // first render, as React renders a hydrated component again with the browser's answer.
  const isServerSnapshot = React.useSyncExternalStore(subscribe, isBrowserRender, isServerRender)
  const [isFirstHtml] = React.useState(isServerSnapshot)
  const isHanded = React.useSyncExternalStore(
    subscribe,
    () => isEveryApplied(texts),
    isNothingHanded
  )

  React.useInsertionEffect(() => {
    if (isFirstHtml) recordDocumentNonce(nonce)
    const documentNonce = readDocumentNonce(document)
    if (documentNonce !== undefined) writeTexts(document, prefix, texts, documentNonce)
  }, [isFirstHtml, nonce, prefix, texts])

  if (!isFirstHtml || isHanded) return null
  const shownHrefs = shown === undefined ? undefined : new Set(shown)
  const inPlace = texts.filter(({ href }) => shownHrefs?.has(href) ?? true)
  if (inPlace.length === 0) return null
  return React.createElement(
    'style',
    { nonce, 'data-umber-inline': [prefix, ...inPlace.map(({ href }) => href)].join(' ') },
    inPlace.map(({ text }) => text).join('')
  )
}
