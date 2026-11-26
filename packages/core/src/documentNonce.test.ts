import { readPageNonce } from './documentNonce'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

/** An element `tag` of the head with a `nonce` attribute; with no sheet when `isRefused`, as one the policy refused. */
function addNonced(tag: 'style' | 'script', nonce: string, isRefused = false): HTMLElement {
  const element = document.createElement(tag)
  element.setAttribute('nonce', nonce)
  document.head.append(element)
  if (isRefused) Object.defineProperty(element, 'sheet', { value: null })
  return element
}

describe('readPageNonce', () => {
  it('is undefined on a page with no nonce', () => {
    document.head.innerHTML = '<style>p{}</style><script></script>'
    expect(readPageNonce(document)).toBeUndefined()
  })

  it('is the nonce of a style element the policy let in, before that of a script', () => {
    addNonced('script', 'from-script')
    expect(readPageNonce(document)).toBe('from-script')
    addNonced('style', 'applied')
    expect(readPageNonce(document)).toBe('applied')
  })

  it('is never that of a style element the policy refused, injected with a nonce it does not allow', () => {
    addNonced('style', 'injected', true)
    expect(readPageNonce(document)).toBeUndefined()
    addNonced('script', 'from-script')
    expect(readPageNonce(document)).toBe('from-script')
  })

  it('reads the property, which the browser keeps when it hides the attribute, and skips an empty one', () => {
    const hidden = addNonced('style', '')
    Object.defineProperty(hidden, 'nonce', { value: 'kept' })
    expect(readPageNonce(document)).toBe('kept')
    hidden.remove()
    addNonced('style', '')
    addNonced('script', '')
    expect(readPageNonce(document)).toBeUndefined()
  })

  it('reads the page it is given', () => {
    const page = document.implementation.createHTMLDocument('other')
    page.head.innerHTML = '<script nonce="other"></script>'
    addNonced('script', 'this')
    expect(readPageNonce(page)).toBe('other')
  })
})
