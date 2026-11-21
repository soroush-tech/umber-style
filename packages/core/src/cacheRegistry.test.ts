import { createCache, createDomSheet, createMemorySheet } from './cache'
import { findCache } from './cacheRegistry'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('findCache', () => {
  it('gives the first cache of a prefix that writes into a style element of the document', () => {
    expect(findCache('reg-a', document)).toBeUndefined()
    const first = createCache({ prefix: 'reg-a', hasDevChecks: false })
    createCache({ prefix: 'reg-a', hasDevChecks: false, sheet: createDomSheet('reg-a') })
    const other = createCache({ prefix: 'reg-b', hasDevChecks: false })
    expect(findCache('reg-a', document)).toBe(first)
    expect(findCache('reg-b', document)).toBe(other)
  })

  it('does not give a cache over a sheet in memory, and keeps the caches of another document apart', () => {
    createCache({ prefix: 'reg-c', hasDevChecks: false, sheet: createMemorySheet() })
    expect(findCache('reg-c', document)).toBeUndefined()
    const frame = document.implementation.createHTMLDocument('frame')
    const inFrame = createCache({
      prefix: 'reg-c',
      hasDevChecks: false,
      sheet: createDomSheet('reg-c', frame.head),
    })
    expect(findCache('reg-c', frame)).toBe(inFrame)
    expect(findCache('reg-c', document)).toBeUndefined()
  })
})
