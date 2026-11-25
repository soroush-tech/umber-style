import {
  isEasingWord,
  readCssNumber,
  readEasing,
  readTime,
  readTransform,
  splitList,
  splitWords,
  toCamelCase,
} from './motionText'

describe('splitList and splitWords', () => {
  it('cut at the commas and the white space outside parentheses, and leave out empty parts', () => {
    expect(splitList('opacity 1s cubic-bezier(0, 0, 1, 1), transform 2s,')).toEqual([
      'opacity 1s cubic-bezier(0, 0, 1, 1)',
      'transform 2s',
    ])
    expect(splitWords(' pulse\t1s\nsteps(2, end)\r ')).toEqual(['pulse', '1s', 'steps(2, end)'])
  })
})

describe('readCssNumber and readTime', () => {
  it('read a number as CSS writes one, and nothing else', () => {
    expect([readCssNumber('1'), readCssNumber('-.5'), readCssNumber('1e3')]).toEqual([
      1, -0.5, 1000,
    ])
    expect([
      readCssNumber(''),
      readCssNumber('0x10'),
      readCssNumber('1-'),
      readCssNumber('e'),
    ]).toEqual([undefined, undefined, undefined, undefined])
  })

  it('read a time in s or ms, and a finite number as milliseconds', () => {
    expect([readTime('1.5s'), readTime(' 300MS '), readTime(250), readTime('-1s')]).toEqual([
      1500, 300, 250, -1000,
    ])
    expect([
      readTime('1'),
      readTime('1h'),
      readTime('s'),
      readTime(Infinity),
      readTime(null),
    ]).toEqual([undefined, undefined, undefined, undefined, undefined])
  })
})

describe('readEasing', () => {
  it('reads the names, curves and steps of CSS, in any case', () => {
    expect(readEasing(' Ease-In ')).toEqual({ kind: 'named', name: 'ease-in' })
    expect(readEasing('cubic-bezier(0.1, 0.7, 1, 0.1)')).toEqual({
      kind: 'cubic-bezier',
      points: [0.1, 0.7, 1, 0.1],
    })
    expect(readEasing('steps(4)')).toEqual({ kind: 'steps', count: 4, position: 'end' })
    expect(readEasing('steps(2, jump-none)')).toEqual({
      kind: 'steps',
      count: 2,
      position: 'jump-none',
    })
  })

  it('reads nothing from text that is not a valid easing', () => {
    for (const text of [
      'cubic-bezier(-0.1, 0, 1, 1)',
      'cubic-bezier(0, 0, 1.1, 1)',
      'cubic-bezier(0, a, 1, 1)',
      'steps(-1)',
      'steps(a)',
      'steps(1, jump-none)',
      'steps(2, sideways)',
      'cubic-bezier(0, 0, 1, 1',
      'wobble',
    ]) {
      expect(readEasing(text)).toBeUndefined()
    }
  })

  it('tells a word that looks like an easing', () => {
    expect(
      ['linear', 'steps(2)', 'cubic-bezier(0,0,1,1)', 'linear(0, 1)'].every(isEasingWord)
    ).toBe(true)
    expect(isEasingWord('pulse')).toBe(false)
  })
})

describe('toCamelCase', () => {
  it('names a CSS property as the platform does, and keeps a name that is already so', () => {
    expect([
      toCamelCase('border-top-left-radius'),
      toCamelCase('opacity'),
      toCamelCase('backgroundColor'),
    ]).toEqual(['borderTopLeftRadius', 'opacity', 'backgroundColor'])
  })
})

describe('readTransform', () => {
  it('passes the text of the transforms the library reads, and gives no transform for none', () => {
    for (const text of [
      'translateX(-8px) rotate(45deg)',
      'translate(10%, 4) scale(1.05, 2) skew(0, 0.5rad)',
      'translateY(50%) scaleX(2) scaleY(0.5) rotateX(0) rotateY(1rad) rotateZ(-90deg)',
      'skewX(10deg) skewY(-1.5deg) perspective(800)',
      'matrix(1, 0, 0, 1, 10, 20)',
    ]) {
      expect(readTransform(` ${text} `)).toBe(text)
    }
    expect(readTransform('none')).toEqual([])
  })

  it('reads nothing from a transform the library would reject', () => {
    for (const text of [
      'rotate(1turn)',
      'rotate(45)',
      'rotate(.5deg)',
      'translate3d(1px, 2px, 3px)',
      'translateX(1em, 2px)',
      'translateX(5deg)',
      'translateX(.5%)',
      'scale(1%)',
      'scale(a)',
      'matrix(1, 0, 0, 1)',
      'matrix(1, 0, 0, 1, 0, x)',
      'rotate 45deg',
      'rotate 45deg)',
      'rotate(45deg',
      '',
    ]) {
      expect(readTransform(text)).toBeUndefined()
    }
  })
})
