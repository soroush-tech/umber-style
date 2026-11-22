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

  it('runs the checks that need no page with hasDevChecks, and has no page to check', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = createCache({ prefix: 'n', hasLayers: false, hasDevChecks: true })
    const name = cache.css({ width: true } as never)
    expect(warn.mock.calls).toEqual([
      [
        `[n] the class ${name} declares "width" as true, which is never a CSS value: give a string or a number.`,
      ],
    ])
    warn.mockRestore()
  })
})
