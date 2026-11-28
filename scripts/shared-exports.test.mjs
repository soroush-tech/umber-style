import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findMinifiedExports, readExportSpecifiers } from './shared-exports.mjs'

describe('readExportSpecifiers', () => {
  it('reads each specifier of a statement that starts a line, renamed or not', () => {
    assert.deepEqual(readExportSpecifiers('const a = 1\nexport { a as b, c };\n'), [
      { local: 'a', exported: 'b' },
      { local: 'c', exported: 'c' },
    ])
  })

  it('reads a re-export from another module', () => {
    assert.deepEqual(readExportSpecifiers('export { styled as default } from "x";'), [
      { local: 'styled', exported: 'default' },
    ])
  })

  it('ignores a clause that does not start a line, and an empty one', () => {
    assert.deepEqual(readExportSpecifiers('// see export { a as b }\nexport {};\n'), [])
  })

  it('reads to the end of the line when the clause is not closed on it', () => {
    assert.deepEqual(readExportSpecifiers('export { a as b,'), [{ local: 'a', exported: 'b' }])
  })
})

describe('findMinifiedExports', () => {
  it('lists the names renamed to one or two characters', () => {
    const chunk = 'export { writeLiveValue as $, globalStyles as D, alpha as Ct, add };'
    assert.deepEqual(findMinifiedExports(chunk), [
      'writeLiveValue as $',
      'globalStyles as D',
      'alpha as Ct',
    ])
  })

  it('passes the names a shared chunk exports unrenamed', () => {
    assert.deepEqual(findMinifiedExports('export { at, createPropFilter, globalStyles };'), [])
  })

  it('passes a rename to a public name', () => {
    const lines = [
      'export { isPropValid as default, isPropValid };',
      'export { Appearance as platformAppearance } from "react-native";',
    ]
    assert.deepEqual(findMinifiedExports(lines.join('\n')), [])
  })
})
