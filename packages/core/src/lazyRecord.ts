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
  return createLazyRecord(Object.keys(source), (key) => (built ??= build())[key])
}
