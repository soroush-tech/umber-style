import { createCache, createDomSheet } from './cache'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

const elementsOf = (key: string) => [...document.querySelectorAll(`style[data-style="${key}"]`)]

describe('the style element of a sheet', () => {
  it.each([false, true])(
    'is made at the first rule, with the nonce, and not when the sheet is made (speedy: %s)',
    (speedy) => {
      const sheet = createDomSheet('e', document.head, { speedy, nonce: 'n0nce' })
      expect(elementsOf('e')).toEqual([])
      expect(sheet.document).toBe(document)
      sheet.insert('.a{color:red;}')
      const [element] = elementsOf('e')
      expect(elementsOf('e')).toHaveLength(1)
      expect(element.getAttribute('nonce')).toBe('n0nce')
      expect(element.parentNode).toBe(document.head)
    }
  )

  it('is made by a cache at its first rule, and never by a cache that writes nothing', () => {
    const quiet = createCache({ prefix: 'q', nonce: 'n0nce' })
    expect(quiet.document).toBe(document)
    expect(elementsOf('q')).toEqual([])
    const cache = createCache({ prefix: 'w', nonce: 'n0nce', speedy: true })
    expect(elementsOf('w')).toEqual([])
    const name = cache.css({ color: 'red' })
    const elements = elementsOf('w') as HTMLStyleElement[]
    expect(elements).toHaveLength(1)
    expect(elements[0].getAttribute('nonce')).toBe('n0nce')
    // The layer order and the class, as the cache wrote them.
    expect((elements[0].sheet as CSSStyleSheet).cssRules).toHaveLength(2)
    expect(cache.extract().css).toBe(
      `@layer w-theme,w-global,w-components,w-overrides;@layer w-components{.${name}{color:red;}}`
    )
    expect(elementsOf('q')).toEqual([])
  })

  it('stays when its last rule is removed, written by insertRule, and takes the next rule', () => {
    const sheet = createDomSheet('k', document.head, { speedy: true })
    sheet.insert('.a{color:red;}')
    sheet.remove?.(0)
    expect(elementsOf('k')).toHaveLength(1)
    sheet.insert('.b{color:blue;}')
    expect(elementsOf('k')).toHaveLength(1)
    expect(sheet.rules).toEqual(['.b{color:blue;}'])
  })

  it('is an empty element of the key that the page placed, taken by the first sheet of the key to write', () => {
    document.head.innerHTML = '<meta name="a"><style data-style="p"></style><meta name="b">'
    const placed = elementsOf('p')[0]
    const first = createDomSheet('p', document.head, { speedy: false, nonce: 'n0nce' })
    const second = createDomSheet('p', document.head, { speedy: false })
    // Made first, written second: the element of the page goes to the sheet that writes first.
    second.insert('.second{color:blue;}')
    first.insert('.first{color:red;}')
    expect(placed.textContent).toBe('.second{color:blue;}')
    expect(placed.hasAttribute('nonce')).toBe(false)
    const made = elementsOf('p').at(-1) as HTMLStyleElement
    expect(made.textContent).toBe('.first{color:red;}')
    expect(made.getAttribute('nonce')).toBe('n0nce')
    expect(document.head.lastElementChild).toBe(made)
  })
})
