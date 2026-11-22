import { onBeforeUnmount, onMounted, useId } from 'vue'
import {
  createLiveValue,
  declareLiveValue,
  hashString,
  writeLiveValue,
  type Cache,
  type LiveRule,
} from '@umber-style/core'
import { injectCache } from './CacheProvider'
import type { StyleValueRef } from './types'

/**
 * Makes `useStyleValue` for the cache `readCache` gives (the engine's), or the one of a `CacheProvider`
 * above. It is called in `setup`: the value is made with a variable named from Vue's `useId`, so the
 * server and the browser name it alike, its rule is declared when the component is mounted, with the
 * number it holds then, and removed before it unmounts. Setting `value` changes the declaration in
 * place, and renders nothing: the value is not reactive.
 */
export function createUseStyleValue(readCache: () => Cache) {
  return function useStyleValue(initial: number, unit?: string): StyleValueRef {
    const cache = injectCache() ?? readCache()
    const value = createLiveValue(
      `--${cache.prefix}-value-${hashString(useId() as string)}`,
      initial,
      unit
    )
    let rule: LiveRule | undefined
    onMounted(() => {
      rule = declareLiveValue(cache, value)
    })
    onBeforeUnmount(() => {
      ;(rule as LiveRule).remove()
      rule = undefined
    })
    // The shape of a ref: `value` reads the number and sets it.
    return Object.defineProperty(value, 'value', {
      get: () => value.get(),
      set: (next: number) => {
        const text = writeLiveValue(value, next)
        rule?.set(text)
      },
    }) as StyleValueRef
  }
}
