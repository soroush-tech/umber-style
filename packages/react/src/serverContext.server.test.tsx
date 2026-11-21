import * as React from 'react'
import { createRequestSlot, type CacheFunction } from './serverContext'

/** One request: a cache that keeps the value it made, like `React.cache` does inside a server render. */
function createRequest(): CacheFunction {
  return (make) => {
    let value: ReturnType<typeof make> | undefined
    return () => (value ??= make())
  }
}

describe('createRequestSlot', () => {
  it('starts at the default, unset, and keeps what is written for the request', () => {
    const slot = createRequestSlot('default', createRequest())
    expect(slot()).toEqual({ current: 'default', isSet: false })
    slot().current = 'root'
    slot().isSet = true
    expect(slot()).toEqual({ current: 'root', isSet: true })
  })

  it('keeps a request apart from the next one', () => {
    const first = createRequestSlot('default', createRequest())
    const second = createRequestSlot('default', createRequest())
    first().current = 'a'
    expect(first().current).toBe('a')
    expect(second().current).toBe('default')
  })

  it('uses React.cache, which keeps nothing outside a server render', () => {
    expect(typeof React.cache).toBe('function')
    expect((React as unknown as Record<string, unknown>).useContext).toBeUndefined()
    const slot = createRequestSlot('default')
    slot().current = 'lost'
    // Outside a render React.cache calls the function each time: the slot is new on every read.
    expect(slot().current).toBe('default')
  })
})
