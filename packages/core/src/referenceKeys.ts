/** Whether `value` is an object or a list that a theme view holds, which the guard wraps in turn. */
function isBranch(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

/** The dotted path of the leaf of `node` that is `reference`, or undefined when none is. */
function findReferencePath(node: unknown, reference: string, path = ''): string | undefined {
  if (node === reference) return path
  if (!isBranch(node)) return undefined
  for (const [key, value] of Object.entries(node)) {
    const found = findReferencePath(value, reference, path ? `${path}.${key}` : key)
    if (found !== undefined) return found
  }
  return undefined
}

/** Whether `target` may give a wrapped value for `key`: a property that can be neither changed nor reconfigured must be given as it is. */
function isWrappable(target: object, key: string | symbol): boolean {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
  return descriptor === undefined || descriptor.configurable || descriptor.writable === true
}

/**
 * A function that gives a theme view wrapped for the style functions of the component labelled `label`:
 * a read of any part of it with a key that is a token reference of this engine (`var(--<prefix>-`)
 * warns, once for each message, through `warn`. In a style function a token is a reference, not its
 * value, so such a lookup (`theme.space[theme.layout.margin]`) gives `undefined`. `readRefs` gives the
 * references of the base theme, to name the token. For the development checks only: an engine without
 * them passes the view as it is.
 */
export function createReferenceGuard(
  prefix: string,
  readRefs: () => unknown,
  warn: (key: string, message: string) => void
): (view: object, label: string) => object {
  const start = `var(--${prefix}-`
  // One wrapper for each object and label, so that a view read twice is the same object.
  const wrappers = new WeakMap<object, Map<string, object>>()

  const report = (label: string, path: string, key: string): void => {
    const owner = label ? ` of "${label}"` : ''
    const token = findReferencePath(readRefs(), key)
    const where = path ? `theme.${path}` : 'theme'
    const mode = token === undefined ? 'the token' : `"${token}"`
    const message = `A style function${owner} reads ${where}[${key}]: ${key} is a token reference, not the value of the token, so the lookup gives undefined. Give ${mode} a raw mode (modes: { '${token ?? '<path>'}': 'raw' }), or read the real value from useTheme().`
    warn(message, message)
  }

  const wrap = (target: object, label: string, path: string): object => {
    let byLabel = wrappers.get(target)
    if (byLabel === undefined) {
      byLabel = new Map()
      wrappers.set(target, byLabel)
    }
    let wrapper = byLabel.get(label)
    if (wrapper === undefined) {
      wrapper = new Proxy(target, {
        get(object, key, receiver) {
          if (typeof key === 'string' && key.startsWith(start)) report(label, path, key)
          const value: unknown = Reflect.get(object, key, receiver)
          if (!isBranch(value) || typeof key !== 'string' || !isWrappable(object, key)) return value
          return wrap(value, label, path ? `${path}.${key}` : key)
        },
      })
      byLabel.set(label, wrapper)
    }
    return wrapper
  }

  return (view, label) => wrap(view, label, '')
}
