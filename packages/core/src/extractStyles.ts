import type { Cache } from './cache'

/** The style element of a server render or a static page: everything `cache` inserted, and the ids that a cache made in the browser skips. */
export function createStyleTag(cache: Cache): string {
  const { css, ids } = cache.extract()
  return `<style data-style="${cache.prefix}" data-ids="${ids.join(' ')}">${css}</style>`
}
