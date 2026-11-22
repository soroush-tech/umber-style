import { createPropFilter, expandNames } from './propFilter'

describe('expandNames', () => {
  it('reads a name with no colon as itself, and a group as its head and each tail', () => {
    expect([...expandNames('alt stroke:,Width,Opacity in:,2').keys()]).toEqual([
      'alt',
      'stroke',
      'strokeWidth',
      'strokeOpacity',
      'in',
      'in2',
    ])
  })

  it('takes the tails after the last colon, so a name that holds a colon is written with a second', () => {
    expect([...expandNames('xlink::href,role xmlns::xlink').keys()]).toEqual([
      'xlink:href',
      'xlink:role',
      'xmlns:xlink',
    ])
  })

  it('answers true for every name', () => {
    expect([...expandNames('a b:c').values()]).toEqual([true, true])
  })
})

describe('createPropFilter', () => {
  it('is true for a listed name and for a name the pattern matches, false for any other', () => {
    const isValid = createPropFilter('alt href', /^data-/)
    expect(isValid('alt')).toBe(true)
    expect(isValid('data-row-1')).toBe(true)
    expect(isValid('tone')).toBe(false)
  })

  it('gives the same answer to a name asked again', () => {
    const isValid = createPropFilter('alt', /^data-/)
    for (const name of ['alt', 'data-x', 'tone']) {
      expect(isValid(name)).toBe(isValid(name))
    }
  })

  it('keeps no state between two filters', () => {
    const isAlt = createPropFilter('alt', /^$/)
    const isHref = createPropFilter('href', /^$/)
    expect([isAlt('alt'), isAlt('href'), isHref('alt'), isHref('href')]).toEqual([
      true,
      false,
      false,
      true,
    ])
  })

  it('answers for a name that an object has on its prototype only when it is listed', () => {
    const isValid = createPropFilter('alt', /^data-/)
    expect(['__proto__', 'constructor', 'toString'].map(isValid)).toEqual([false, false, false])
  })
})
