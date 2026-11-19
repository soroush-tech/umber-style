import * as React from 'react'
import { createServerOnlyContext, readServerContext, type CacheFunction } from './serverContext'
import { resolveTree } from './resolveTree'

/** One request: a cache that keeps the value it made, like `React.cache` does inside a server render. */
function createRequest(): CacheFunction {
  return (make) => {
    let value: ReturnType<typeof make> | undefined
    return () => (value ??= make())
  }
}

describe('createServerOnlyContext', () => {
  it('has the default until a provider writes, and keeps what the first provider wrote', async () => {
    const context = createServerOnlyContext('default', createRequest())
    expect(readServerContext(context)).toBe('default')
    const seen: string[] = []
    const Probe = () => {
      seen.push(readServerContext(context))
      return null
    }
    await resolveTree(
      <context.Provider value="root">
        <Probe />
        <context.Provider value="nested">
          <Probe />
        </context.Provider>
        <Probe />
      </context.Provider>
    )
    expect(seen).toEqual(['root', 'root', 'root'])
    expect(readServerContext(context)).toBe('root')
  })

  it('keeps a request apart from the next one', () => {
    const first = createServerOnlyContext('default', createRequest())
    const second = createServerOnlyContext('default', createRequest())
    first.Provider({ value: 'a' })
    expect(readServerContext(first)).toBe('a')
    expect(readServerContext(second)).toBe('default')
  })

  it('returns its children', () => {
    const context = createServerOnlyContext(0, createRequest())
    const children = React.createElement('i')
    expect(context.Provider({ value: 1, children })).toBe(children)
  })

  it('uses React.cache, which keeps nothing outside a server render', () => {
    expect(typeof React.cache).toBe('function')
    expect((React as unknown as Record<string, unknown>).useContext).toBeUndefined()
    const context = createServerOnlyContext('default')
    context.Provider({ value: 'lost' })
    // Outside a render React.cache calls the function each time: the slot is new on every read.
    expect(readServerContext(context)).toBe('default')
  })
})
