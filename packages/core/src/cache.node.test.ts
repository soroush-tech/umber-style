// @vitest-environment node
import { createCache } from './cache'

describe('createCache without a document', () => {
  it('keeps its rules in memory', () => {
    const cache = createCache()
    const name = cache.css({ color: 'red' })
    expect(cache.extract()).toEqual({ css: `.${name}{color:red;}`, ids: [name] })
  })
})
