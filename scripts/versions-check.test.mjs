import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findVersionProblems, readCoreVersion, selectPublishable } from './versions-check.mjs'

const source = "// c\nexport const CORE_VERSION = '1.2.0'\n"
const family = () => [
  { name: 'a', version: '1.2.0', dependencies: { b: 'workspace:^' } },
  { name: 'b', version: '1.2.0', peerDependencies: { c: 'workspace:^', react: '^19' } },
  { name: 'c', version: '1.2.0', devDependencies: { a: 'workspace:*', x: 'workspace:^' } },
  { name: 'p', version: '0.0.0', private: true, dependencies: { a: 'workspace:*' } },
]

describe('readCoreVersion', () => {
  it('reads the string CORE_VERSION is set to', () => {
    assert.equal(readCoreVersion(source), '1.2.0')
  })

  it('gives undefined without the declaration', () => {
    assert.equal(readCoreVersion('export const OTHER = 1'), undefined)
  })

  it('gives undefined when the string is not closed', () => {
    assert.equal(readCoreVersion("export const CORE_VERSION = '1.2.0"), undefined)
  })
})

describe('selectPublishable', () => {
  it('leaves out the private packages only', () => {
    assert.deepEqual(
      selectPublishable(family()).map(({ name }) => name),
      ['a', 'b', 'c']
    )
  })
})

describe('findVersionProblems', () => {
  it('finds nothing in a family that agrees', () => {
    assert.deepEqual(findVersionProblems(family(), source), [])
  })

  it('names the versions and the packages that have each', () => {
    const manifests = family()
    manifests[1].version = '1.3.0'
    const [line, ...rest] = findVersionProblems(manifests, source)
    assert.equal(line, 'The packages carry different versions: 1.2.0 (a, c); 1.3.0 (b)')
    assert.equal(rest.length, 1)
  })

  it('names a CORE_VERSION that differs', () => {
    assert.deepEqual(findVersionProblems(family(), "export const CORE_VERSION = '1.1.0'"), [
      'CORE_VERSION is 1.1.0 in packages/core/src/sharedState.ts, the packages carry 1.2.0',
    ])
  })

  it('names a missing CORE_VERSION', () => {
    assert.deepEqual(findVersionProblems(family(), ''), [
      'CORE_VERSION is not declared in packages/core/src/sharedState.ts',
    ])
  })

  it('names a sibling in dependencies or peerDependencies that is not workspace:^', () => {
    const manifests = family()
    manifests[0].dependencies.b = 'workspace:*'
    manifests[1].peerDependencies.c = '^1.2.0'
    assert.deepEqual(findVersionProblems(manifests, source), [
      'a declares b as workspace:* in dependencies, not workspace:^',
      'b declares c as ^1.2.0 in peerDependencies, not workspace:^',
    ])
  })

  it('names a sibling in devDependencies that is not workspace:*', () => {
    const manifests = family()
    manifests[2].devDependencies.a = 'workspace:^'
    assert.deepEqual(findVersionProblems(manifests, source), [
      'c declares a as workspace:^ in devDependencies, not workspace:*',
    ])
  })

  it('does not check a dependency that is not a sibling', () => {
    const manifests = family()
    manifests[0].dependencies.p = '^1.0.0'
    assert.deepEqual(findVersionProblems(manifests, source), [])
  })
})
