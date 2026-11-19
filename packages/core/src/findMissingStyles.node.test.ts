// @vitest-environment node
import { findMissingStyles } from './findMissingStyles'

describe('findMissingStyles without a document', () => {
  it('finds nothing', () => {
    expect(findMissingStyles()).toEqual([])
  })
})
