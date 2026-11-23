import { createCache, createMemorySheet } from './cache'
import { extractPageStyles } from './extractStyles'

afterEach(() => {
  document.head.innerHTML = ''
})

/**
 * A page that a server rendered with the class of `style`, read by a cache of the browser with the
 * memo `hasStyleMemo`: the class it gives for the same contents, twice; then the server's element is
 * removed (a navigation), and the same contents come once more. What the head holds after each step.
 */
function hydrate(hasStyleMemo: boolean) {
  const style = { color: 'red', padding: 8 }
  const server = createCache({ prefix: 'h', sheet: createMemorySheet() })
  const serverClass = server.css({ ...style })
  document.head.innerHTML = extractPageStyles(server, `<p class="${serverClass}"></p>`).tag
  const cache = createCache({ prefix: 'h', hasDevChecks: false, hasStyleMemo })
  const classes = [cache.css({ ...style }), cache.css({ ...style })]
  const read = () => document.head.innerHTML
  const afterHydration = read()
  document.head.querySelector('style')?.remove()
  classes.push(cache.css({ ...style }), cache.css({ color: 'blue' }), cache.css({ color: 'blue' }))
  return { serverClass, classes, afterHydration, afterNavigation: read(), extract: cache.extract() }
}

describe('the memo of contents over a page a server rendered', () => {
  it('writes no second rule for a class the page has, and names it as the server did', () => {
    const on = hydrate(true)
    expect(on.classes.slice(0, 2)).toEqual([on.serverClass, on.serverClass])
    expect(on.afterHydration.match(/color:red/g)).toHaveLength(1)
  })

  it('does what the cache does without it once the page loses the element', () => {
    const off = hydrate(false)
    document.head.innerHTML = ''
    expect(hydrate(true)).toEqual(off)
  })
})
