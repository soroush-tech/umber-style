/** What a shorthand can be: a tag name, a lowercase letter then letters and digits (`div`, `h1`, `foreignObject`). */
const TAG_PATTERN = /^[a-z][a-zA-Z0-9]*$/

/**
 * `styled` with a shorthand for every tag: `styled.div(...styles)` is `styled('div')(...styles)`. Nothing
 * is made up front: a member that the function does not have and that looks like a tag name is made when
 * it is read. `then` is not a tag, so that `styled` is never taken for a promise.
 */
export function withTagShorthands<F extends object>(styled: F): F {
  return new Proxy(styled, {
    get(target, key, receiver) {
      if (typeof key !== 'string' || key in target || key === 'then' || !TAG_PATTERN.test(key)) {
        return Reflect.get(target, key, receiver) as unknown
      }
      return (target as (tag: string) => unknown)(key)
    },
  })
}
