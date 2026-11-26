import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findUnpinnedNext, pickNextVersion, pinNext, readPinnedNext } from './next-pin.mjs'

const next = ['16.0.0', '16.0.9', '16.0.11', '16.4.6', '16.5.0-canary.69', '16.5.0-preview.0']

describe('pickNextVersion', () => {
  it('takes the newest stable patch of a minor, by number and not by text', () => {
    assert.equal(pickNextVersion('16.0', next), '16.0.11')
  })

  it('takes an exact version as it is', () => {
    assert.equal(pickNextVersion('16.0.9', next), '16.0.9')
  })

  it('refuses a minor that has only prereleases, and an exact version npm does not have', () => {
    for (const spec of ['16.5', '16.4.7'])
      assert.throws(() => pickNextVersion(spec, next), new RegExp(`npm has no next ${spec}`))
  })

  it('refuses what is neither a minor nor a version', () => {
    for (const spec of ['16', 'latest', '^16.0.0', '16.5.0-canary.69', undefined])
      assert.throws(() => pickNextVersion(spec, next), /Expected a Next.js minor/)
  })
})

describe('pinNext', () => {
  it('adds the override to a manifest that has no pnpm field', () => {
    assert.deepEqual(pinNext({ name: 'root' }, '16.4.6'), {
      name: 'root',
      pnpm: { overrides: { next: '16.4.6' } },
    })
  })

  it('keeps the other pnpm settings and overrides, a React pin included, and replaces a pin', () => {
    const manifest = {
      pnpm: { onlyBuiltDependencies: ['esbuild'], overrides: { react: '19.0.9', next: '16.0.11' } },
    }
    assert.deepEqual(pinNext(manifest, '16.3.8'), {
      pnpm: { onlyBuiltDependencies: ['esbuild'], overrides: { react: '19.0.9', next: '16.3.8' } },
    })
  })
})

describe('readPinnedNext', () => {
  it('reads the version next is pinned to', () => {
    assert.equal(readPinnedNext(pinNext({}, '16.0.11')), '16.0.11')
  })

  it('refuses a manifest with no pin', () => {
    for (const manifest of [{}, { pnpm: {} }, { pnpm: { overrides: { react: '19.0.9' } } }])
      assert.throws(() => readPinnedNext(manifest), /pins no Next.js/)
  })
})

describe('findUnpinnedNext', () => {
  it('finds nothing wrong when every copy is the pinned version', () => {
    const installed = [
      { member: '@umber-style/react', version: '16.0.11' },
      { member: '@umber-fixtures/next-app', version: '16.0.11' },
    ]
    assert.deepEqual(findUnpinnedNext(installed, '16.0.11'), [])
  })

  it('names each copy of another version', () => {
    const installed = [
      { member: '@umber-style/react', version: '16.0.11' },
      { member: '@umber-fixtures/next-app', version: '16.4.6' },
    ]
    assert.deepEqual(findUnpinnedNext(installed, '16.0.11'), [
      '@umber-fixtures/next-app resolves next 16.4.6, not 16.0.11',
    ])
  })

  it('fails when no member resolves next, rather than passing on nothing', () => {
    assert.deepEqual(findUnpinnedNext([], '16.0.11'), ['No workspace member resolves next'])
  })
})
