// @vitest-environment node
import { createMemorySheet } from '@umber-style/core'
import createInstance from './createInstance'

/** A nested style that counts the reads of its values: a compile reads them, a style the memo finds is not compiled. */
function createProbe() {
  const probe = { reads: 0, hover: {} as { color: string } }
  probe.hover = new Proxy(
    { color: 'red' },
    {
      get(target, key, receiver) {
        probe.reads++
        return Reflect.get(target, key, receiver) as unknown
      },
    }
  )
  return probe
}

describe('an instance with the memo of contents', () => {
  it('writes the rule again after flush, when the same contents come again', () => {
    const sheet = createMemorySheet()
    const instance = createInstance({ key: 'f', sheet, hasStyleMemo: true })
    const className = instance.css({ color: 'red' })
    instance.flush()
    expect(sheet.rules).toEqual([])
    expect(instance.css({ color: 'red' })).toBe(className)
    expect(instance.css({ color: 'red' })).toBe(className)
    expect(sheet.rules).toEqual([`.${className}{color:red;}`])
  })

  it('names a style with a condition as without the memo (docs/style-memo.md)', () => {
    const { css } = createInstance({ key: 'title', hasStyleMemo: true })
    const title = (isMobile: boolean) => css({ fontSize: isMobile ? 12 : 48 })
    const mobile = title(true) // compiled and named
    expect(title(true)).toBe(mobile) // compiled again, and remembered
    expect(title(true)).toBe(mobile) // found by its contents: not compiled
    const plain = createInstance({ key: 'title' })
    expect([title(false), title(true)]).toEqual([plain.css({ fontSize: 48 }), mobile])
  })

  it('compiles a style it found by its contents no more, where an instance without it does', () => {
    const [off, on] = [false, true].map((hasStyleMemo) => {
      const probe = createProbe()
      const { css } = createInstance({ key: 'probe', hasStyleMemo })
      const classes = Array.from({ length: 6 }, () => css({ margin: 0, '&:hover': probe.hover }))
      return { classes, reads: probe.reads }
    })
    expect(on.classes).toEqual(off.classes)
    expect(on.reads).toBeLessThan(off.reads)
  })
})
