import type { Cache } from './cache'
import { createPageCheck, type LabelReader, type PageCheck } from './devChecks'
import { readSharedState } from './sharedState'

// The cache of each prefix in each document: the first one made that writes into a style element there,
// by any copy of the core, so that code of another copy finds it.
const registry = readSharedState('core.caches@1', () => new WeakMap<Document, Map<string, Cache>>())

/** Records `cache` as the cache of its prefix in `page`, unless a cache of that prefix was recorded there before. */
export function registerCache(page: Document, cache: Cache): void {
  let caches = registry.get(page)
  if (caches === undefined) {
    caches = new Map()
    registry.set(page, caches)
  }
  if (!caches.has(cache.prefix)) caches.set(cache.prefix, cache)
}

/**
 * The cache of `prefix` in `page`: the first cache of that prefix made with a sheet in a style element of
 * that document (`createCache` records it), or undefined where none was made. It is how code that has no
 * engine of its own (a component that a server component renders, in the browser) reaches the cache of the
 * page, for example to release a global rule that a server sent.
 */
export function findCache(prefix: string, page: Document): Cache | undefined {
  return registry.get(page)?.get(prefix)
}

// The development check of each prefix in each document, which every cache of that prefix that writes
// into that document asks for, by any copy of the core: one run, and one warning for each problem.
const pageChecks = readSharedState(
  'core.page-checks@1',
  () => new WeakMap<Document, Map<string, PageCheck>>()
)

/**
 * The function that asks for the development check of `page` for `prefix`, the one that every cache of
 * that prefix writing into `page` shares (`createPageCheck`, made by the first that asks): the page is
 * looked at once for all of them, every problem is warned about once, and the rules of each cache are asked
 * about with the labels of its own classes (`readLabel`).
 */
export function joinPageCheck(
  prefix: string,
  page: Document,
  readLabel: LabelReader
): (rules?: readonly string[]) => void {
  let checks = pageChecks.get(page)
  if (checks === undefined) {
    checks = new Map()
    pageChecks.set(page, checks)
  }
  let check = checks.get(prefix)
  if (check === undefined) {
    check = createPageCheck(prefix, undefined, page)
    checks.set(prefix, check)
  }
  const shared = check
  return (rules) => shared(rules, readLabel)
}
