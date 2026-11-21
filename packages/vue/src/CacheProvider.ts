import { defineComponent, inject, provide, type InjectionKey, type PropType } from 'vue'
import type { Cache } from '@umber-style/core'

/** What the nearest `CacheProvider` provides: its cache. */
const CACHE_KEY: InjectionKey<Cache> = Symbol('cache')

// Whether a `CacheProvider` has been set up in this module: until then no component looks for one, so
// that an app that has none pays nothing.
let isProvided = false

/** The cache of the nearest `CacheProvider`, or undefined with none above. Call it in `setup` or in a functional component. */
export function injectCache(): Cache | undefined {
  return isProvided ? inject(CACHE_KEY, undefined) : undefined
}

/**
 * Gives the subtree in its slot its cache: every rule that a component of the binding writes there goes
 * to `value` (classes, sheet entries, global rules, keyframes, the root theme and the theme classes of the
 * providers below), through the engine of the same theme over that cache. Outside any provider the
 * engine's own cache is used. `value` is read once, in `setup`: to give the subtree another cache, render
 * another provider (a new `key`).
 */
export const CacheProvider = defineComponent({
  name: 'CacheProvider',
  props: {
    /** The cache of the subtree: one that `createCache` of `@umber-style/cache` (or of the core) made. */
    value: { type: Object as PropType<Cache>, required: true },
  },
  setup(props, { slots }) {
    isProvided = true
    provide(CACHE_KEY, props.value)
    return () => slots.default?.()
  },
})
