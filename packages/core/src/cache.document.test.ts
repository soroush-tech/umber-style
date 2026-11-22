import { createCache, createDomSheet, createMemorySheet } from './cache'
import { createDevChecker } from './devChecks'
import { findMissingStyles } from './findMissingStyles'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The document of an iframe added to the page. */
function createFrameDocument(): Document {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  return iframe.contentDocument as Document
}

/** A style element of the registry of an app, `data-umber="<key> <ids>"`, with `css` as its text. */
function addRegistryElement(parent: HTMLElement, css: string, ids = 'u-late') {
  const element = parent.ownerDocument.createElement('style')
  element.setAttribute('data-umber', `u ${ids}`)
  element.textContent = css
  parent.appendChild(element)
  return element
}

describe('createDomSheet in another document', () => {
  it('looks up and creates its style element in the document of its container', () => {
    const frame = createFrameDocument()
    const sheet = createDomSheet('u', frame.head)
    expect(sheet.document).toBe(frame)
    expect(frame.querySelectorAll('style[data-style="u"]')).toHaveLength(1)
    expect(document.querySelector('style[data-style="u"]')).toBeNull()
    sheet.insert('.u-a{color:red;}')
    expect(frame.querySelector('style')?.sheet?.cssRules[0].cssText).toBe('.u-a { color: red; }')
    // A second sheet of the key looks in that document: one by insertRule finds the element there that
    // is not written by text; one by text uses an empty element there that no sheet uses.
    createDomSheet('u', frame.body, { speedy: true })
    const marker = frame.createElement('style')
    marker.dataset.style = 'u'
    frame.body.appendChild(marker)
    createDomSheet('u', frame.body, { speedy: false }).insert('.u-b{color:blue;}')
    expect(marker.textContent).toBe('.u-b{color:blue;}')
    expect(document.querySelector('style[data-style="u"]')).toBeNull()
  })

  it('has the global document by default', () => {
    expect(createDomSheet('u').document).toBe(document)
  })
})

describe('a cache whose sheet is in another document', () => {
  it('reads the style elements of that document, and not those of the page', () => {
    const frame = createFrameDocument()
    addRegistryElement(frame.head, '@layer u-components{.u-framed{color:red;}}', 'u-framed')
    addRegistryElement(document.head, '@layer u-components{.u-main{color:red;}}', 'u-main')
    const cache = createCache({ prefix: 'u', sheet: createDomSheet('u', frame.head) })
    expect(cache.insertOnce('u-framed', ['a{}'], 'components')).toBe(false)
    expect(cache.insertOnce('u-main', ['a{}'], 'components')).toBe(true)
  })

  it('compares the stamp of the server in that document', () => {
    const frame = createFrameDocument()
    const meta = frame.createElement('meta')
    meta.name = 'u-options'
    meta.content = 'p=other'
    frame.head.appendChild(meta)
    expect(() => createCache({ prefix: 'u', sheet: createDomSheet('u', frame.head) })).toThrow(
      /prefix/
    )
    // The page itself has no stamp.
    expect(() => createCache({ prefix: 'u', sheet: createMemorySheet() })).not.toThrow()
  })

  it('notices the elements that arrive in that document later, in its head or its body', async () => {
    const frame = createFrameDocument()
    const cache = createCache({ prefix: 'u', sheet: createDomSheet('u', frame.head) })
    addRegistryElement(frame.body, '@layer u-components{.u-late{color:red;}}', 'u-late')
    addRegistryElement(document.body, '@layer u-components{.u-main{color:red;}}', 'u-main')
    await settle()
    expect(cache.insertOnce('u-late', ['a{}'], 'components')).toBe(false)
    expect(cache.insertOnce('u-main', ['a{}'], 'components')).toBe(true)
  })

  it('writes its rules into that document only', () => {
    const frame = createFrameDocument()
    const cache = createCache({ prefix: 'u', sheet: createDomSheet('u', frame.head) })
    const name = cache.css({ color: 'red' })
    const text = [...frame.querySelectorAll('style')].flatMap((element) =>
      [...(element.sheet as CSSStyleSheet).cssRules].map((rule) => rule.cssText)
    )
    expect(text.join('')).toContain(`.${name}`)
    expect(document.querySelector('style')).toBeNull()
  })
})

describe('a style element streamed into the body', () => {
  it('is read when it arrives as a child of the body, after the cache started', async () => {
    const cache = createCache({ prefix: 'u', sheet: createMemorySheet() })
    addRegistryElement(document.body, '@layer u-components{.u-late{color:var(--u-a);}}', 'u-late')
    await settle()
    expect(cache.insertOnce('u-late', ['a{}'], 'components')).toBe(false)
    expect(cache.usedVariables.has('--u-a')).toBe(true)
  })

  it('is read in a document that had no body when the cache started, once the body is added', async () => {
    const frame = createFrameDocument()
    const body = frame.body
    body.remove()
    const cache = createCache({ prefix: 'u', sheet: createDomSheet('u', frame.head) })
    frame.documentElement.appendChild(body)
    await settle()
    addRegistryElement(body, '@layer u-components{.u-late{color:red;}}', 'u-late')
    await settle()
    expect(cache.insertOnce('u-late', ['a{}'], 'components')).toBe(false)
  })
})

describe('the check of the page in another document', () => {
  it('reads the elements and the style elements of the document it is given', () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const frame = createFrameDocument()
    const element = frame.createElement('p')
    element.className = 'u-missing'
    frame.body.appendChild(element)
    const main = document.createElement('p')
    main.className = 'u-elsewhere'
    document.body.appendChild(main)
    createDevChecker('u', 10, frame)()
    vi.advanceTimersByTime(10)
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      '[u] p[] has the class u-missing, which no rule names',
    ])
  })

  it('finds what an element of another document misses, with the rules of that document', () => {
    const frame = createFrameDocument()
    const sheet = createDomSheet('u', frame.head)
    sheet.insert('.u-named{color:red;}')
    const element = frame.createElement('p')
    element.className = 'u-named u-missing'
    frame.body.appendChild(element)
    expect(findMissingStyles(element).map(({ name }) => name)).toEqual(['u-missing'])
    expect(findMissingStyles(frame).map(({ name }) => name)).toEqual(['u-missing'])
  })
})
