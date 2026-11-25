import { readNonceSource, setNonceSource } from './nonceSource'
import { readSharedState } from './sharedState'

describe('the source of the nonce of a request', () => {
  it('is none until one is registered, the one registered last, and none once taken back', () => {
    expect(readNonceSource()).toBeUndefined()
    const first = () => 'first'
    const second = async () => 'second'
    setNonceSource(first)
    expect(readNonceSource()).toBe(first)
    setNonceSource(second)
    expect(readNonceSource()).toBe(second)
    setNonceSource(undefined)
    expect(readNonceSource()).toBeUndefined()
  })

  it('is shared by every copy of the core, under one key', () => {
    const source = () => 'shared'
    setNonceSource(source)
    expect(readSharedState('core.nonce-source@1', () => ({ source: undefined }))).toEqual({
      source,
    })
    setNonceSource(undefined)
  })
})
