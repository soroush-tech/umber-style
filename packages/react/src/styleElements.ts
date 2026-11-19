import { createElement, type ReactElement } from 'react'
import type { Cache } from '@umber-style/core'

/**
 * The `<style href precedence>` elements for the classes in `className`: React 19 moves them to the
 * head and renders each `href` once. The precedence is the prefix of the cache. Each one starts with the order statement of the layers (none without layers), so that it is right on its own: declaring a layer again does not change the order. A name that the
 * cache made no rules for (a class of someone else) gets none. A theme class comes with every variable it has, used or not: its element is sent before the elements that use them, so it cannot know which are used.
 */
export function createStyleElements(cache: Cache, className: string | undefined): ReactElement[] {
  return (className ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((name) => {
      const rules = cache.getFullRules(name)
      if (rules.length === 0) return []
      const props = { key: name, href: name, precedence: cache.prefix }
      return [createElement('style', props, [cache.layerOrder, ...rules].join(''))]
    })
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
