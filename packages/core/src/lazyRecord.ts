/**
 * An object with one key for each of `keys`, whose value is made by `make` the first time the key is
 * read, and kept. `Object.keys` and a spread list the keys (a spread reads every one); nothing is made
 * until then. The object is frozen.
 */
export function createLazyRecord<K extends string, V>(
  keys: readonly K[],
  make: (key: K) => V
): { readonly [P in K]: V } {
  const record = {} as { [P in K]: V }
  for (const key of keys) {
    let value: V | undefined
    let isMade = false
    Object.defineProperty(record, key, {
      enumerable: true,
      get() {
        if (!isMade) {
          value = make(key)
          isMade = true
        }
        return value
      },
    })
  }
  return Object.freeze(record)
}

/**
 * `createLazyRecord` for the keys of `source`, with every value taken from the record that `build` makes,
 * which is called once, when the first key is read: for a sheet whose engine must not be made, or whose
 * platform call must not run, before it is used.
 */
export function createDeferredRecord<V>(
  source: object,
  build: () => Record<string, V>
): Readonly<Record<string, V>> {
  let built: Record<string, V> | undefined
  return createLazyRecord(Object.keys(source), (key) => {
    built ??= build()
    return built[key]
  })
}

/**
 * An object that stands for the one `make` returns, which is made the first time the object is used in
 * any way (a property read, `in`, a listing of its keys, a check of whether it is frozen): from then on it
 * has the same properties, and is frozen as that one is. When `make` throws, the next use tries again. For a value that a module makes before the
 * engine it needs may exist, such as a `css()` result of a default style before `configure` is called.
 */
export function createDeferredObject<V extends object>(make: () => V): V {
  const target = {}
  let isMade = false
  const ensure = (): object => {
    if (!isMade) {
      const made = make()
      isMade = true
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(made))
      Object.setPrototypeOf(target, Object.getPrototypeOf(made))
      if (Object.isFrozen(made)) Object.freeze(target)
    }
    return target
  }
  return new Proxy(target, {
    get: (_target, key) => Reflect.get(ensure(), key),
    has: (_target, key) => Reflect.has(ensure(), key),
    ownKeys: () => Reflect.ownKeys(ensure()),
    getOwnPropertyDescriptor: (_target, key) => Reflect.getOwnPropertyDescriptor(ensure(), key),
    getPrototypeOf: () => Reflect.getPrototypeOf(ensure()),
    isExtensible: () => Reflect.isExtensible(ensure()),
  }) as V
}
