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

  it('takes the memo of contents, hasStyleMemo, and names what it names without it (docs/style-memo.md)', () => {
    // A nested style that counts the reads of its values: a style the memo finds is not compiled.
    let reads = 0
    const hover = new Proxy(
      { color: 'red' },
      {
        get(target, key, receiver) {
          reads++
          return Reflect.get(target, key, receiver) as unknown
        },
      }
    )
    const runs = [false, true].map((hasStyleMemo) => {
      reads = 0
      const cache = hasStyleMemo
        ? createCache({ key: 'page', hasStyleMemo: true })
        : createCache({ key: 'page' })
      const classes = Array.from({ length: 6 }, () => cache.css({ margin: 0, '&:hover': hover }))
      return { classes, reads, css: cache.extract().css }
    })
    expect(runs[1].classes).toEqual(runs[0].classes)
    expect(runs[1].css).toBe(runs[0].css)
    expect(runs[1].reads).toBeLessThan(runs[0].reads)
  })
})
