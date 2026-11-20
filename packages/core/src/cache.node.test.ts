// @vitest-environment node
import { createCache } from './cache'

describe('createCache without a document', () => {
  it('keeps its rules in memory', () => {
    const cache = createCache({ hasLayers: false })
    const name = cache.css({ color: 'red' })
    expect(cache.extract()).toEqual({ css: `.${name}{color:red;}`, ids: [name] })
  })

  it('writes global rules with no page to take them from', () => {
    const cache = createCache({ hasLayers: false })
    cache.insertGlobal(cache.compileGlobal({ body: { margin: 0 } }), { isRendered: true })
    expect(cache.extract().css).toBe('body{margin:0;}')
  })
})
