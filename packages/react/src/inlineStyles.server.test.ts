import { isValidElement, type ReactElement } from 'react'
import { createCache, createMemorySheet, setNonceSource } from '@umber-style/core'
import { createStyleSender, isInlineMode } from './inlineStyles.server'
import type { CacheFunction } from './serverContext'

const a = { href: 'is-a', text: '.is-a{color:red;}' }
const b = { href: 'is-b', text: '.is-b{color:blue;}' }
const c = { href: 'is-c', text: '.is-c{color:green;}' }

// The request being rendered: the slots of `React.cache` are made again for each one.
let request = 0
const requestCache: CacheFunction = (make) => {
  let value: ReturnType<typeof make> | undefined
  let madeFor = -1
  return () => {
    if (madeFor !== request) {
      value = make()
      madeFor = request
    }
    return value as ReturnType<typeof make>
  }
}

afterEach(() => {
  setNonceSource(undefined)
  request += 1
})

/** The sender of a cache of the prefix `is`, with `nonce` as the nonce of the cache. */
const setup = (nonce?: string) =>
  createStyleSender(createCache({ prefix: 'is', sheet: createMemorySheet(), nonce }), requestCache)

/** The type and the props of each element, for a comparison. */
const readElements = (elements: ReactElement[]) =>
  elements.map((element) => {
    expect(isValidElement(element)).toBe(true)
    const { type, props, key } = element as ReactElement<Record<string, unknown>>
    const name = typeof type === 'string' ? type : (type as unknown as { $$id: string }).$$id
    return { name, key, props }
  })

describe('isInlineMode', () => {
  it('is on for a request with a nonce, whether a source gave it or only the cache has it, and off for none', () => {
    expect(isInlineMode('n')).toBe(true)
    expect(isInlineMode(undefined)).toBe(false)
    setNonceSource(() => 'n')
    expect(isInlineMode('n')).toBe(true)
    expect(isInlineMode(undefined)).toBe(false)
  })
})

describe('createStyleSender', () => {
  it('sends the hoisted elements of 0.6.0, with no nonce, for a request with none, with or without a source', () => {
    const send = setup()
    expect(readElements(send([a], undefined))).toEqual([
      {
        name: 'style',
        key: 'is-a',
        props: { href: 'is-a', precedence: 'is', nonce: undefined, children: a.text },
      },
    ])
    setNonceSource(() => undefined)
    expect(readElements(send([a, b], undefined)).map(({ name }) => name)).toEqual([
      'style',
      'style',
    ])
  })

  it('sends NonceStyles with the fixed nonce of the cache where no source is registered', () => {
    const send = setup('fixed')
    expect(readElements(send([a], 'fixed'))).toEqual([
      {
        name: 'NonceStyles',
        key: 'nonce-styles',
        props: { prefix: 'is', texts: [a], nonce: 'fixed' },
      },
    ])
  })

  it('sends one NonceStyles with every text in inline mode, and nothing for no text', () => {
    setNonceSource(() => 'request')
    const send = setup()
    expect(send([], 'request')).toEqual([])
    expect(readElements(send([a, b], 'request'))).toEqual([
      {
        name: 'NonceStyles',
        key: 'nonce-styles',
        props: { prefix: 'is', texts: [a, b], nonce: 'request' },
      },
    ])
  })

  it('shows each text in place once in a request, in the order the request renders, and again in the next one', () => {
    setNonceSource(() => 'request')
    const send = setup()
    const shownOf = (texts: (typeof a)[]) => readElements(send(texts, 'request'))[0].props.shown
    expect(shownOf([a, b])).toBeUndefined()
    expect(shownOf([b, c])).toEqual(['is-c'])
    expect(shownOf([a, c])).toEqual([])
    request += 1
    expect(shownOf([c])).toBeUndefined()
  })
})
