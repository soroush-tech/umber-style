import createCache, { type UmberCache } from '@umber-style/cache'
import { createEngine } from '@umber-style/core'
import createInstance from './createInstance'

const theme = { palette: { primary: '#0000ff' }, space: [0, 4, 8] }

/** The engine calls of a page: a theme, global rules, a class with an animation. */
function renderPage(cache: UmberCache) {
  const engine = createEngine(theme, { cache })
  const themeClass = engine.themeClass(theme, 'dark')
  const fade = engine.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
  engine.insertGlobal({ body: { margin: engine.refs.space[1] } })
  const box = engine.css({ color: engine.refs.palette.primary, animation: `${fade} 1s` })
  return `<div class="${themeClass}"><p class="${box}">x</p></div>`
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('a page written with constructStyleTagsFromChunks', () => {
  it('is read by a cache in the browser, which writes none of its rules again', () => {
    vi.stubGlobal('document', undefined)
    const server = createCache({ key: 'app' })
    const html = renderPage(server)
    vi.unstubAllGlobals()
    const { constructStyleTagsFromChunks, extractCriticalToChunks } = createInstance(server)
    document.head.innerHTML = constructStyleTagsFromChunks(extractCriticalToChunks(html))
    document.body.innerHTML = html

    const cache = createCache({ key: 'app', hasDevChecks: false })
    expect(cache.sheet.tags.map((tag) => tag.dataset.umber?.split(' ')[0])).toEqual([
      'app-global',
      'app',
      undefined,
    ])
    const written: string[] = []
    const prevInsert = cache.insert
    cache.insert = (...args) => {
      written.push(args[1].name)
      return prevInsert(...args)
    }
    expect(renderPage(cache)).toBe(html)
    expect(written).toEqual([])
  })
})
