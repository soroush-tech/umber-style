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

  it.each([
    ['', '0'],
    ['a', 'acqbnw'],
    ['color:red;', 'tokvmb'],
    ['.x{display:flex;}', 't3zg6e'],
    ['h\u00e9llo w\u00f6rld \u2605 caf\u00e9', 'z12hay'],
  ])('keeps the hash of %j (ASCII and BMP text) at %s', (text, expected) => {
    expect(hashString(text)).toBe(expected)
  })

  it('hashes an astral character by its code point (was 1ajlp8z by its UTF-16 units)', () => {
    expect(hashString('abc\u{1F600}def')).toBe('mo7i65')
  })

  it('does not throw on a lone surrogate', () => {
    expect(hashString('\uD83D')).toBe('1ek03rz')
    expect(hashString('x\uDE00y')).toBe('182vi8u')
  })
})
