import { createCache, createMemorySheet } from '@umber-style/core'
import { createStyleElements } from './styleElements'

describe('createStyleElements', () => {
  it('makes a style element for each class the cache has rules for, with the prefix as precedence', () => {
    const cache = createCache({ prefix: 'e', sheet: createMemorySheet() })
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
    const cache = createCache({ prefix: 'e', sheet: createMemorySheet() })
    expect(createStyleElements(cache, undefined)).toEqual([])
    expect(createStyleElements(cache, 'a  b')).toEqual([])
  })
})
