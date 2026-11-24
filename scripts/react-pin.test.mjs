import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findUnpinned, pickReactVersion, pinReact, readPinnedReact } from './react-pin.mjs'

const react = ['19.0.0', '19.0.9', '19.0.10', '19.1.10', '19.2.0-canary-1', '19.2.0', '19.3.1']

describe('pickReactVersion', () => {
  it('takes the newest stable patch of a minor, by number and not by text', () => {
    assert.equal(pickReactVersion('19.0', react, react), '19.0.10')
  })

  it('leaves out a prerelease of the minor', () => {
    assert.equal(pickReactVersion('19.2', react, react), '19.2.0')
  })

  it('takes the newest patch that react-dom has too', () => {
    assert.equal(pickReactVersion('19.0', react, ['19.0.0', '19.0.9']), '19.0.9')
  })

  it('takes an exact version as it is', () => {
    assert.equal(pickReactVersion('19.0.9', react, react), '19.0.9')
  })

  it('refuses an exact version that react-dom does not have', () => {
    assert.throws(
      () => pickReactVersion('19.3.1', react, ['19.0.9']),
      /npm has no react and react-dom 19\.3\.1/
    )
  })

  it('refuses a minor with no stable patch', () => {
    assert.throws(
      () => pickReactVersion('19.4', react, react),
      /npm has no react and react-dom 19\.4/
    )
  })

  it('refuses what is neither a minor nor a version', () => {
    for (const spec of ['19', 'latest', '^19.0.0', '19.2.0-canary-1', undefined])
      assert.throws(() => pickReactVersion(spec, react, react), /Expected a React minor/)
  })
})

describe('pinReact', () => {
  it('adds the overrides to a manifest that has no pnpm field', () => {
    assert.deepEqual(pinReact({ name: 'root' }, '19.0.9'), {
      name: 'root',
      pnpm: { overrides: { react: '19.0.9', 'react-dom': '19.0.9' } },
    })
  })

  it('keeps the other pnpm settings and overrides, and replaces a pin', () => {
    const manifest = {
      pnpm: { onlyBuiltDependencies: ['esbuild'], overrides: { foo: '1.0.0', react: '19.1.10' } },
    }
    assert.deepEqual(pinReact(manifest, '19.0.9'), {
      pnpm: {
        onlyBuiltDependencies: ['esbuild'],
        overrides: { foo: '1.0.0', react: '19.0.9', 'react-dom': '19.0.9' },
      },
    })
  })
})

describe('readPinnedReact', () => {
  it('reads the version both packages are pinned to', () => {
    assert.equal(readPinnedReact(pinReact({}, '19.1.10')), '19.1.10')
  })

  it('refuses a manifest with no pin, or with react and react-dom apart', () => {
    for (const manifest of [{}, { pnpm: {} }, { pnpm: { overrides: { react: '19.0.9' } } }])
      assert.throws(() => readPinnedReact(manifest), /pins no React/)
  })
})

describe('findUnpinned', () => {
  it('finds nothing wrong when every copy is the pinned version', () => {
    const installed = [
      { member: '@umber-style/react', name: 'react', version: '19.0.9' },
      { member: '@umber-style/react', name: 'react-dom', version: '19.0.9' },
    ]
    assert.deepEqual(findUnpinned(installed, '19.0.9'), [])
  })

  it('names each copy of another version', () => {
    const installed = [
      { member: '@umber-style/react', name: 'react', version: '19.0.9' },
      { member: '@umber-fixtures/spa', name: 'react-dom', version: '19.3.1' },
    ]
    assert.deepEqual(findUnpinned(installed, '19.0.9'), [
      '@umber-fixtures/spa resolves react-dom 19.3.1, not 19.0.9',
    ])
  })

  it('fails when no member resolves either package, rather than passing on nothing', () => {
    assert.deepEqual(findUnpinned([], '19.0.9'), [
      'No workspace member resolves react or react-dom',
    ])
  })
})
