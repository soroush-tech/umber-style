import { createCache, createMemorySheet, keyframes } from '@umber-style/core'
import {
  collectStyleTexts,
  createStyleElements,
  createTextElements,
  ELEMENT_LIST_LIMIT,
} from './styleElements'

const spin = keyframes({ to: { transform: 'rotate(360deg)' } }, { label: 'spin' })

/** A cache whose sheet is in memory; layers off, so a text is its rules alone. */
function setup(options: { nonce?: string } = {}) {
  return createCache({ hasLayers: false, prefix: 'e', sheet: createMemorySheet(), ...options })
}

describe('createStyleElements', () => {
  it('makes a style element for each class the cache has rules for, with the prefix as precedence', () => {
    const cache = createCache({ hasLayers: false, prefix: 'e', sheet: createMemorySheet() })
    const className = cache.css({ color: 'red', '&:hover': { color: 'blue' } })
    const elements = createStyleElements(cache, `external ${className}`)
    expect(elements).toHaveLength(1)
    expect(elements[0].key).toBe(className)
    expect(elements[0].props).toEqual({
      href: className,
      precedence: 'e',
      children: `.${className}{color:red;}.${className}:hover{color:blue;}`,
    })
  })

  it('makes none for nothing, or for a class of someone else', () => {
    const cache = createCache({ hasLayers: false, prefix: 'e', sheet: createMemorySheet() })
    expect(createStyleElements(cache, undefined)).toEqual([])
    expect(createStyleElements(cache, 'a  b')).toEqual([])
  })
})

describe('createStyleElements: the list of a class string is remembered', () => {
  it('gives the elements that the texts of the classes make, the first time and each time after', () => {
    const cache = setup({ nonce: 'n1' })
    const first = cache.css({ color: 'red' })
    const second = cache.css({ animation: `${spin} 1s`, margin: 0 })
    const className = `external ${first}  ${second}`
    const expected = createTextElements(cache, collectStyleTexts(cache, className), 'n1')
    const elements = createStyleElements(cache, className)
    expect(elements).toEqual(expected)
    expect(elements.map((element) => element.key)).toEqual([first, spin, second])
    expect(elements[0].props).toMatchObject({ nonce: 'n1', precedence: 'e' })
    expect(createStyleElements(cache, className)).toBe(elements)
    expect(createStyleElements(cache, className)).toEqual(expected)
  })

  it('keeps a list for a string with a class of someone else, and for no string at all', () => {
    const cache = setup()
    const className = `external ${cache.css({ color: 'red' })}`
    expect(createStyleElements(cache, className)).toBe(createStyleElements(cache, className))
    expect(createStyleElements(cache, undefined)).toBe(createStyleElements(cache, undefined))
    expect(createStyleElements(cache, '')).toEqual([])
  })

  it('keeps a list for each cache', () => {
    const one = setup()
    const other = setup()
    const className = one.css({ color: 'red' })
    expect(other.css({ color: 'red' })).toBe(className)
    const elements = createStyleElements(one, className)
    expect(createStyleElements(other, className)).not.toBe(elements)
    expect(createStyleElements(other, className)).toEqual(elements)
  })

  it('gives each nonce a list of its own, and the nonce of the cache by default', () => {
    const cache = setup({ nonce: 'cache-nonce' })
    const className = cache.css({ color: 'red' })
    const byDefault = createStyleElements(cache, className)
    const other = createStyleElements(cache, className, 'other')
    const none = createStyleElements(cache, className, undefined)
    expect(byDefault[0].props).toMatchObject({ nonce: 'cache-nonce' })
    expect(other[0].props).toMatchObject({ nonce: 'other' })
    expect(none[0].props).toMatchObject({ nonce: 'cache-nonce' })
    expect(createStyleElements(cache, className, 'other')).toBe(other)
    expect(createStyleElements(cache, className)).toBe(byDefault)
    expect(other).not.toBe(byDefault)
    expect(createStyleElements(setup(), className, undefined)).toEqual([])
  })

  it('makes a new list for a class that the cache did not have and has now', () => {
    const cache = setup()
    const className = cache.css({ color: 'red' })
    const before = createStyleElements(cache, `${className} later`)
    expect(before).toHaveLength(1)
    cache.insertOnce('later', ['.later{color:blue;}'])
    const after = createStyleElements(cache, `${className} later`)
    expect(after).not.toBe(before)
    expect(after.map((element) => element.key)).toEqual([className, 'later'])
  })

  it('makes a new list for a class that was let go and is written again', async () => {
    vi.useFakeTimers()
    const cache = setup()
    const held = cache.cssHeld({}, { margin: 3 })
    const release = held.hold?.() as () => void
    const first = createStyleElements(cache, held.className)
    expect(first).toHaveLength(1)
    release()
    await vi.runAllTimersAsync()
    expect(createStyleElements(cache, held.className)).toEqual([])
    const again = cache.cssHeld({}, { margin: 3 })
    expect(again.className).toBe(held.className)
    const second = createStyleElements(cache, again.className)
    expect(second).not.toBe(first)
    expect(second).toEqual(first)
    vi.useRealTimers()
  })

  it('makes a new list when the animations of a class are not the ones it had', () => {
    const cache = setup()
    const className = cache.css({ animation: `${spin} 1s` })
    let animations = cache.getAnimations(className)
    const view = { ...cache, getAnimations: () => animations }
    const first = createStyleElements(view, className)
    expect(first.map((element) => element.key)).toEqual([spin, className])
    expect(createStyleElements(view, className)).toBe(first)
    animations = []
    const second = createStyleElements(view, className)
    expect(second).not.toBe(first)
    expect(second.map((element) => element.key)).toEqual([className])
  })

  it('is emptied when a cache holds its limit of class strings, or of nonces', () => {
    const cache = setup()
    const first = createStyleElements(cache, 'first')
    for (let index = 0; index < ELEMENT_LIST_LIMIT; index++) createStyleElements(cache, `s${index}`)
    expect(createStyleElements(cache, 'first')).not.toBe(first)
    const byNonce = createStyleElements(cache, 'first', 'nonce-first')
    for (let index = 0; index < ELEMENT_LIST_LIMIT; index++) {
      createStyleElements(cache, 'first', `nonce-${index}`)
    }
    expect(createStyleElements(cache, 'first', 'nonce-first')).not.toBe(byNonce)
  })
})
