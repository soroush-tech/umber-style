// @vitest-environment node
import createCache from './index'

describe('createCache without a document', () => {
  it('keeps its rules in memory and has no style elements', () => {
    const cache = createCache({ key: 'app' })
    const box = cache.css({ color: 'red' })
    expect(cache.sheet.tags).toEqual([])
    expect(cache.inserted).toEqual({ 'app-layers': true, [box]: true })
    expect(cache.extract().css).toContain(`.${box}{color:red;}`)
  })
})
