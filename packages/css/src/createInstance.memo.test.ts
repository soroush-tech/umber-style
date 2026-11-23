// @vitest-environment node
import { createMemorySheet } from '@umber-style/core'
import createInstance from './createInstance'

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
})
