import { isNameCode, readName, toLabelPart } from './cssName'

describe('isNameCode', () => {
  it.each(['a', 'z', 'A', 'Z', '0', '9', '-', '_', '\u00e9', '\u4e2d'])('holds %j', (character) => {
    expect(isNameCode(character.codePointAt(0) as number)).toBe(true)
  })

  it.each([' ', '.', ':', '#', '/', '"', '\\', '{', '`', '@', '[', '\u007f'])(
    'does not hold %j',
    (character) => {
      expect(isNameCode(character.codePointAt(0) as number)).toBe(false)
    }
  )

  it('does not hold NaN', () => {
    expect(isNameCode(Number.NaN)).toBe(false)
  })
})

describe('readName', () => {
  it('reads letters of either case, digits, hyphens and underscores', () => {
    expect(readName('.css-Typography_1-x{', 1)).toEqual(['css-Typography_1-x', 19])
  })

  it('reads non-ASCII letters, a pair included', () => {
    expect(readName('a\u00fc\u4e2d\u{1f600}b ', 0)).toEqual(['a\u00fc\u4e2d\u{1f600}b', 6])
  })

  it.each([' ', ',', '>', '+', '~', ':', '[', '.', '{', '#', '/', ')'])(
    'ends at the delimiter %j',
    (delimiter) => {
      expect(readName(`Ab-1${delimiter}c`, 0)).toEqual(['Ab-1', 4])
    }
  )

  it('reads from the index it is given and returns the empty name where none starts', () => {
    expect(readName('a.b', 2)).toEqual(['b', 3])
    expect(readName('a.b', 1)).toEqual(['', 1])
    expect(readName('', 0)).toEqual(['', 0])
  })

  it('decodes an escape of a character as itself', () => {
    expect(readName('a\\.b\\:c d', 0)).toEqual(['a.b:c', 7])
  })

  it('decodes hex escapes of one to six digits, with one white space after them', () => {
    expect(readName('a\\3a b', 0)).toEqual(['a:b', 6])
    expect(readName('a\\3A  b', 0)).toEqual(['a:', 5])
    expect(readName('a\\000041b', 0)).toEqual(['aAb', 9])
    expect(readName('a\\41\nb', 0)).toEqual(['aAb', 6])
  })

  it('reads at most six hex digits of an escape', () => {
    expect(readName('\\1f600 1', 0)).toEqual(['\u{1f600}1', 8])
    expect(readName('\\0000411', 0)).toEqual(['A1', 8])
  })

  it('turns zero, a surrogate and a code point past U+10FFFF into U+FFFD', () => {
    expect(readName('\\0 a', 0)[0]).toBe('\ufffda')
    expect(readName('\\d800 a', 0)[0]).toBe('\ufffda')
    expect(readName('\\110000 a', 0)[0]).toBe('\ufffda')
  })

  it('reads a backslash at the end of the text as an escape of nothing', () => {
    expect(readName('a\\', 0)).toEqual(['a', 3])
  })
})

describe('toLabelPart', () => {
  it.each(['card', 'Typography', 'button-root', 'a_b', 'A1-b_2'])('keeps %j as it is', (label) => {
    expect(toLabelPart(label)).toBe(label)
  })

  it.each([
    ['a space', 'Card Header', 'Card-Header'],
    ['a dot', 'card.title', 'card-title'],
    ['a colon', 'a:b', 'a-b'],
    ['a hash', 'a#b', 'a-b'],
    ['a slash', 'a/b', 'a-b'],
    ['quotes', 'a"b\'c', 'a-b-c'],
    ['braces', 'a{b}c', 'a-b-c'],
    ['a backslash', 'a\\b', 'a-b'],
    ['brackets and parentheses', 'a[b](c)', 'a-b--c-'],
  ])('turns %s into a hyphen: %j is %j', (_name, label, part) => {
    expect(toLabelPart(label)).toBe(part)
  })

  it('writes one hyphen for each character, with no collapsing', () => {
    expect(toLabelPart('a..b')).toBe('a--b')
    expect(toLabelPart('a. :b')).toBe('a---b')
  })

  it('trims white space at the start and the end first', () => {
    expect(toLabelPart('  card \t\n')).toBe('card')
    expect(toLabelPart(' a.b ')).toBe('a-b')
    expect(toLabelPart('.a.')).toBe('-a-')
  })

  it('is empty for a label that is empty once trimmed', () => {
    expect(toLabelPart('')).toBe('')
    expect(toLabelPart(' \t ')).toBe('')
  })

  it('turns each non-ASCII code point into one hyphen, a pair included', () => {
    expect(toLabelPart('caf\u00e9')).toBe('caf-')
    expect(toLabelPart('a\u{1f600}b')).toBe('a-b')
    expect(toLabelPart('\u4e2d\u6587')).toBe('--')
  })

  it('gives hyphens for a label made only of characters that are not kept', () => {
    expect(toLabelPart('.:#')).toBe('---')
  })
})
