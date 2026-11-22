import { createCache, createEngine, createMemorySheet } from '@umber-style/core'
import { bindEngine } from './createStyle.server'
import { configure, useStyleValue } from './index.server'
import type { CacheFunction } from './serverContext'
import { findAll, resolveTree } from './vitest.resolveTree'

/** The slot of one request, which `React.cache` keeps inside a real server render only. */
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  return () => (value ??= make())
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('useStyleValue in the server components build', () => {
  it('is a reference whose fallback is the first number, which the class of a server component carries', async () => {
    const cache = createCache({ prefix: 'sv', sheet: createMemorySheet() })
    const { styled, useStyleValue: useValue } = bindEngine(
      createEngine({}, { prefix: 'sv', cache }),
      requestCache
    )
    const Thumb = styled('div', { name: 'Thumb' })({ position: 'absolute' })
    function Slider() {
      const [left] = useValue(25, '%')
      return <Thumb style={{ left: `${left}` }} />
    }
    const tree = await resolveTree(<Slider />)
    const text = findAll(tree, 'style')
      .map((element) => element.children.join(''))
      .join('')
    expect(text).toContain('{left:var(--sv-value-server, 25%);}')
  })

  it('has a setter that changes only what get() returns, with one warning in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    configure({ prefix: 'sw' })
    const [value, setValue] = useStyleValue(1)
    setValue(2)
    setValue((previous) => previous + 1)
    expect(value.get()).toBe(3)
    expect(String(value)).toBe('var(--sw-value-server, 1)')
    expect(warn.mock.calls).toEqual([
      [
        '[sw] The setter of useStyleValue() was called in a server component, which does not run in the browser: the page keeps the first value. Call useStyleValue() in a client component to change it.',
      ],
    ])
  })
})
