import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY_KEY = Symbol.for('umber-style.registry')
const SOURCE = dirname(fileURLToPath(import.meta.url))

/** A copy of the module as a second copy of the core in the program has it: its own module state, the same `globalThis`. */
async function loadCopy() {
  vi.resetModules()
  return import('./sharedState')
}

/** Forgets the registry of the program, as in a program where no copy has read it yet. */
function clearRegistry(): void {
  Reflect.deleteProperty(globalThis, REGISTRY_KEY)
}

beforeEach(clearRegistry)

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('readSharedState', () => {
  it('makes the state of a key once, and gives it again', async () => {
    const { readSharedState } = await loadCopy()
    const create = vi.fn(() => new Map<string, number>())
    const first = readSharedState('test.state@1', create)
    expect(readSharedState('test.state@1', create)).toBe(first)
    expect(create).toHaveBeenCalledTimes(1)
    expect(readSharedState('test.state@2', () => 'other')).toBe('other')
  })

  it('gives a second copy of the module the state that the first one made', async () => {
    const first = await loadCopy()
    const second = await loadCopy()
    expect(second).not.toBe(first)
    const made = first.readSharedState('test.names@1', () => new Set(['a']))
    expect(second.readSharedState('test.names@1', () => new Set<string>())).toBe(made)
  })

  it('keeps the registry on globalThis, under a key that every copy makes alike', async () => {
    const { readSharedState } = await loadCopy()
    readSharedState('test.state@1', () => 1)
    const registry = Reflect.get(globalThis, REGISTRY_KEY) as Map<string, unknown>
    expect(registry.get('test.state@1')).toBe(1)
    expect(registry.get('core.copies@1')).toEqual([expect.any(String)])
  })
})

describe('the copies of the core', () => {
  it('records the version of this copy, which is that of the package', async () => {
    const manifest = JSON.parse(readFileSync(join(SOURCE, '../package.json'), 'utf8')) as {
      version: string
    }
    const { CORE_VERSION, readSharedState } = await loadCopy()
    expect(CORE_VERSION).toBe(manifest.version)
    readSharedState('test.state@1', () => 1)
    expect(
      (Reflect.get(globalThis, REGISTRY_KEY) as Map<string, unknown>).get('core.copies@1')
    ).toEqual([manifest.version])
  })

  it('warns once in development when a second copy of the same version registers', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = await loadCopy()
    first.readSharedState('test.state@1', () => 1)
    expect(warn).not.toHaveBeenCalled()
    const second = await loadCopy()
    second.readSharedState('test.state@1', () => 2)
    second.readSharedState('test.other@1', () => 3)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe(
      `[umber-style] Two copies of @umber-style/core ${second.CORE_VERSION} are loaded. They share their state, but the code is loaded twice. It usually happens when a package is bundled into a build next to one that is left external, or when two versions are installed in one tree: install one version, and bundle the packages of UmberStyle together or not at all.`
    )
  })

  it('names both versions when a copy of another version registered first', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Reflect.set(globalThis, REGISTRY_KEY, new Map([['core.copies@1', ['0.2.1', '0.2.1']]]))
    const { CORE_VERSION, readSharedState } = await loadCopy()
    readSharedState('test.state@1', () => 1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(
      `[umber-style] @umber-style/core ${CORE_VERSION} is loaded next to @umber-style/core 0.2.1. The copies share the state that both versions store alike, and keep the rest apart. It usually happens`
    )
  })

  it('does not warn about two copies of one version where there is no document, as on a server of server components', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubGlobal('document', undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(await loadCopy()).readSharedState('test.state@1', () => 1)
    ;(await loadCopy()).readSharedState('test.state@1', () => 1)
    expect(warn).not.toHaveBeenCalled()
    Reflect.set(globalThis, REGISTRY_KEY, new Map([['core.copies@1', ['0.2.1']]]))
    ;(await loadCopy()).readSharedState('test.state@1', () => 1)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('does not warn outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(await loadCopy()).readSharedState('test.state@1', () => 1)
    ;(await loadCopy()).readSharedState('test.state@1', () => 1)
    expect(warn).not.toHaveBeenCalled()
  })
})
