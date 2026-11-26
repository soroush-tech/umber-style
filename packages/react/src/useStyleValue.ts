import { useId, useInsertionEffect, useState } from 'react'
import { type Cache, type LiveValue } from '@umber-style/core'
import {
  createLiveValue,
  declareLiveValue,
  hashString,
  writeLiveValue,
} from '@umber-style/core/internal'
import { useProvidedCache } from './CacheProvider'
import type { StyleValueSetter } from './types'

/** One value of a component: the value, its setter, and what declares its rule while the component is mounted. */
interface ValueState {
  readonly value: LiveValue
  readonly set: StyleValueSetter
  /** Declares the rule of the value with the number it holds, and returns what removes the rule. */
  readonly mount: () => () => void
}

/** The state of a value of the variable `name` in `cache`, which holds `initial` written with `unit`. */
function createValueState(cache: Cache, name: string, initial: number, unit?: string): ValueState {
  const value = createLiveValue(name, initial, unit)
  let rule: ReturnType<typeof declareLiveValue> | undefined
  return {
    value,
    // A new number changes the declaration in the rule, in place: nothing renders.
    set: (next) => {
      const text = writeLiveValue(value, typeof next === 'function' ? next(value.get()) : next)
      rule?.set(text)
    },
    mount: () => {
      const declared = declareLiveValue(cache, value)
      rule = declared
      return () => {
        declared.remove()
        rule = undefined
      }
    },
  }
}

/**
 * Makes `useStyleValue` for the cache `readCache` gives (the engine's), or the one of a `CacheProvider`
 * above. The value is made once for the component, with a variable named from its `useId`, so that the
 * server and the browser name it alike; its rule is declared while the component is mounted, with the
 * number it holds then, and removed when it unmounts.
 */
export function createUseStyleValue(readCache: () => Cache) {
  return function useStyleValue(initial: number, unit?: string): [LiveValue, StyleValueSetter] {
    const id = useId()
    const cache = useProvidedCache() ?? readCache()
    const [state] = useState(() =>
      createValueState(cache, `--${cache.prefix}-value-${hashString(id)}`, initial, unit)
    )
    useInsertionEffect(state.mount, [state])
    return [state.value, state.set]
  }
}
