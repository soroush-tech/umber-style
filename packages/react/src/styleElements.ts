import { createElement, type ReactElement } from 'react'
import type { Cache } from '@umber-style/core'

/**
 * The `<style href precedence>` elements for the classes in `className`: React 19 moves them to the
 * head and renders each `href` once. The precedence is the prefix of the cache. A name that the
 * cache made no rules for (a class of someone else) gets none.
 */
export function createStyleElements(cache: Cache, className: string | undefined): ReactElement[] {
  return (className ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((name) => {
      const rules = cache.getRules(name)
      if (rules.length === 0) return []
      const props = { key: name, href: name, precedence: cache.prefix }
      return [createElement('style', props, rules.join(''))]
    })
}
