/** A function that wraps a theme for the functions of `label`: the same wrapper for the same object and label. */
export type ThemeGuard = <V extends object>(theme: V, label: string) => V

/** What the guard is told of a read through it: the label, the dotted path of the object read, and the key. */
type ReadCheck = (label: string, path: string, key: string) => void

/** Whether `value` is a plain object or a list, which the guard wraps in turn; any other value is given as it is. */
function isBranch(value: unknown): value is object {
  if (Array.isArray(value)) return true
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

/** `path` and `key` joined with a dot, `path` alone being the theme itself. */
function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

/** How the error of a write names it: an assignment, a `delete`, or an `Object.defineProperty`. */
type WriteKind = 'set' | 'deleted' | 'defined'

/**
 * The error of a write of `kind` into the theme at `path`.`key` (of `target`), by a function of `label`, with
 * `head` in front (`[prefix] ` of an engine): which path, that the theme is shared, and what to write instead.
 */
function createWriteError(
  head: string,
  label: string,
  target: object,
  path: string,
  key: string | symbol,
  kind: WriteKind
): TypeError {
  const owner = label ? ` of "${label}"` : ''
  const parent = path ? `theme.${path}` : 'theme'
  const name = String(key)
  const copy = Array.isArray(target) ? `[...${parent}]` : `{ ...${parent}, ${name}: value }`
  return new TypeError(
    `${head}${parent}.${name} is ${kind} by a function${owner}. The theme is one object, shared by every render and every request, so a change to it reaches all of them: never change it. Build a new object instead, such as ${copy}.`
  )
}

/**
 * A guard of themes: it wraps a theme, at every level (each plain object and list read through a
 * wrapper is wrapped in turn, once for each object and label), so that a write, a delete or a
 * `defineProperty` of any key throws a `TypeError` that names the path, the label, and the advice.
 * `onRead`, when given, is told of each read of a string key. For the development checks only: what is
 * read is the theme's own value, and a theme passed as it is (without the checks) is the same object.
 */
function createGuard(head: string, onRead?: ReadCheck): ThemeGuard {
  // One wrapper for each object and label, so that a part read twice is the same object.
  const wrappers = new WeakMap<object, Map<string, object>>()

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
          if (typeof key === 'string') onRead?.(label, path, key)
          const value: unknown = Reflect.get(object, key, receiver)
          if (!isBranch(value) || typeof key !== 'string' || !isWrappable(object, key)) return value
          return wrap(value, label, joinPath(path, key))
        },
        set(object, key) {
          throw createWriteError(head, label, object, path, key, 'set')
        },
        deleteProperty(object, key) {
          throw createWriteError(head, label, object, path, key, 'deleted')
        },
        defineProperty(object, key) {
          throw createWriteError(head, label, object, path, key, 'defined')
        },
      })
      byLabel.set(label, wrapper)
    }
    return wrapper
  }

  return <V extends object>(theme: V, label: string) => wrap(theme, label, '') as V
}

/**
 * A guard of themes for the functions of a binding that holds real values (no token references): a write
 * at any level throws, naming the path and the label, with `head` in front of the message. For the
 * development checks only.
 */
export function createThemeGuard(head: string): ThemeGuard {
  return createGuard(head)
}

/**
 * A function that gives a theme view wrapped for the style functions of the component labelled `label`:
 * a read of any part of it with a key that is a token reference of this engine (`var(--<prefix>-`)
 * warns, once for each message, through `warn`. In a style function a token is a reference, not its
 * value, so such a lookup (`theme.space[theme.layout.margin]`) gives `undefined`. `readRefs` gives the
 * references of the base theme, to name the token. A write at any level throws, as `createThemeGuard`
 * says, with `[prefix] ` in front. For the development checks only: an engine without them passes the
 * view as it is.
 */
export function createReferenceGuard(
  prefix: string,
  readRefs: () => unknown,
  warn: (key: string, message: string) => void
): (view: object, label: string) => object {
  const start = `var(--${prefix}-`

  const report = (label: string, path: string, key: string): void => {
    if (!key.startsWith(start)) return
    const owner = label ? ` of "${label}"` : ''
    const token = findReferencePath(readRefs(), key)
    const where = path ? `theme.${path}` : 'theme'
    const mode = token === undefined ? 'the token' : `"${token}"`
    const message = `A style function${owner} reads ${where}[${key}]: ${key} is a token reference, not the value of the token, so the lookup gives undefined. Give ${mode} a raw mode (modes: { '${token ?? '<path>'}': 'raw' }), or read the real value from useTheme().`
    warn(message, message)
  }

  return createGuard(`[${prefix}] `, report)
}
