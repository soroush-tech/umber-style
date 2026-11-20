const BRAND = Symbol.for('umber-style.stand-in')

/**
 * A stand-in for the theme at `path` (a dotted path, '' for the theme itself): any key read from it is
 * a stand-in one level down, a call is a stand-in for `path(arguments)` (a helper of the theme such as
 * `breakpoints.up('md')`), a symbol reads as undefined, and as text it is its path. `keyframes` and
 * `globalStyles` name the styles of a function of the theme with it, so that the name does not depend on
 * the theme's values.
 */
export function createStandIn(path: string): object {
  const call = (...values: unknown[]) => createStandIn(`${path}(${values.map(String).join(',')})`)
  return new Proxy(call, {
    get: (_target, key) => {
      if (key === Symbol.toPrimitive) return () => path
      if (typeof key === 'symbol') return undefined
      return createStandIn(path === '' ? key : `${path}.${key}`)
    },
    has: (_target, key) => key === BRAND,
  })
}

/** Whether `value` was made by `createStandIn`. */
export function isStandIn(value: unknown): value is object {
  return typeof value === 'function' && BRAND in value
}

/** `value` as its path when it is a stand-in, else `value` itself: a helper that computes with a token takes a stand-in as the text of a reference. */
export function readStandIn<V>(value: V): V | string {
  return isStandIn(value) ? String(value) : value
}
