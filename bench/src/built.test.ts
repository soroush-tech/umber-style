import { createRequire, registerHooks } from 'node:module'
import { prepareBuiltPackages } from './built'

// The resolutions end at built-in modules, so that the test needs no build and loads no file of its own
// a second time outside the test runner.
const load = createRequire(import.meta.url)
const environment = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = environment
})

describe('prepareBuiltPackages', () => {
  it('runs in production, sends the core to its build, and loads a redirect in its place', () => {
    // Registered after, so it runs first: it records where the core was sent and loads a built-in
    // module instead.
    const sent: string[] = []
    const built = prepareBuiltPackages({ redirects: { 'umber-bench-probe': 'node:os' } })
    const observer = registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context)
        if (specifier !== '@umber-style/core') return result
        sent.push(result.url)
        return { url: 'node:path', shortCircuit: true }
      },
    })
    try {
      expect(process.env.NODE_ENV).toBe('production')
      load('@umber-style/core')
      expect(sent).toEqual([new URL('../../packages/core/dist/index.cjs', import.meta.url).href])
      expect(load('umber-bench-probe').platform).toBeTypeOf('function')
    } finally {
      observer.deregister()
      built.deregister()
    }
  })

  it('adds its conditions to every other resolution, and has none by default', () => {
    // Registered before, so it runs after: it sees the conditions that were passed on.
    const seen: string[][] = []
    const inner = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (!specifier.startsWith('umber-bench-')) return nextResolve(specifier, context)
        seen.push([...context.conditions])
        return { url: 'node:os', shortCircuit: true }
      },
    })
    const plain = prepareBuiltPackages()
    load('umber-bench-plain')
    plain.deregister()
    const server = prepareBuiltPackages({ conditions: ['react-server'] })
    load('umber-bench-server')
    server.deregister()
    inner.deregister()
    expect(seen[0]).not.toContain('react-server')
    expect(seen[1]).toContain('react-server')
  })
})
