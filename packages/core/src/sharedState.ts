import { isDevelopment } from './devChecks'

/** `process` where there is one, as `devChecks.ts` declares it. */
declare const process: { env: { NODE_ENV?: string } }

/** The version of this copy of the core: what it records, and names in a warning, when it first reads the shared state. */
export const CORE_VERSION = '0.7.0'

// The state that every copy of the packages loaded in one program shares: one Map on `globalThis`, under
// a key that `Symbol.for` gives every copy alike. The Map itself never changes shape. Each entry is keyed
// `<package>.<name>@<shape>`: a release that changes what an entry holds gives the entry a new shape
// number, so an older copy keeps reading the entry it knows, as it knows it, and copies of two shapes
// simply do not share that one entry. Nothing here touches a browser global.
const REGISTRY_KEY = Symbol.for('umber-style.registry')
const COPIES_KEY = 'core.copies@1'
const PREFIX = '[umber-style]'
const CAUSE =
  'It usually happens when a package is bundled into a build next to one that is left external, or when two versions are installed in one tree: install one version, and bundle the packages of UmberStyle together or not at all.'

let registry: Map<string, unknown> | undefined

/**
 * The warning for a copy of the core that registers after the copies of `earlier`: by version when one
 * differs, else that two copies of one version are loaded; none for two copies of one version where there
 * is no document. A server of server components loads the core once for its server components and once
 * for the render of its client components, by design, and those copies share everything: there is
 * nothing to fix there.
 */
function describeCopies(earlier: readonly string[]): string | undefined {
  const others = [...new Set(earlier)].filter((version) => version !== CORE_VERSION)
  if (others.length > 0) {
    return `${PREFIX} @umber-style/core ${CORE_VERSION} is loaded next to @umber-style/core ${others.join(', ')}. The copies share the state that both versions store alike, and keep the rest apart. ${CAUSE}`
  }
  if (typeof document === 'undefined') return undefined
  return `${PREFIX} Two copies of @umber-style/core ${CORE_VERSION} are loaded. They share their state, but the code is loaded twice. ${CAUSE}`
}

/** Records this copy in the list of the copies loaded, and warns in development when it is not the first. */
function registerCopy(shared: Map<string, unknown>): void {
  let copies = shared.get(COPIES_KEY) as string[] | undefined
  if (copies === undefined) {
    copies = []
    shared.set(COPIES_KEY, copies)
  }
  // What `isDevelopment()` reads is written out in front of it, so that a bundler that writes in
  // production for `process.env.NODE_ENV` drops the warning and its text (see `devChecks.md`).
  const warning =
    copies.length > 0 &&
    typeof process === 'object' &&
    process.env != null &&
    process.env.NODE_ENV !== 'production' &&
    isDevelopment()
      ? describeCopies(copies)
      : undefined
  if (warning !== undefined) console.warn(warning)
  copies.push(CORE_VERSION)
}

/** The registry of the program, made by the first copy that asks; this copy registers itself the first time it asks. */
function readRegistry(): Map<string, unknown> {
  if (registry === undefined) {
    const holder = globalThis as unknown as Record<symbol, Map<string, unknown> | undefined>
    registry = holder[REGISTRY_KEY] ?? new Map()
    holder[REGISTRY_KEY] = registry
    registerCopy(registry)
  }
  return registry
}

/**
 * The state that every copy of the packages loaded in this program shares under `key`
 * (`<package>.<name>@<shape>`), made by `create` for the copy that asks first. A module keeps here what
 * another copy must see for the engine to work: a name that one copy registers and another reads. It
 * lives as long as the program, as a module's own state does.
 */
export function readSharedState<T>(key: string, create: () => T): T {
  const shared = readRegistry()
  if (!shared.has(key)) shared.set(key, create())
  return shared.get(key) as T
}
