import { hashString } from './hash'

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('color:red;')).toBe(hashString('color:red;'))
  })

  it('differs for different input', () => {
    expect(hashString('color:red;')).not.toBe(hashString('color:blue;'))
  })

  it.each(['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'abcdefgh'])(
    'returns base 36 text for %j',
    (text) => {
      expect(hashString(text)).toMatch(/^[a-z0-9]+$/)
    }
  )

  it('gives each length from 0 to 5 its own hash', () => {
    const hashes = ['', 'a', 'ab', 'abc', 'abcd', 'abcde'].map(hashString)
    expect(new Set(hashes).size).toBe(hashes.length)
  })
})
