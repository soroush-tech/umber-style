import {
  createFingerprint,
  describeFingerprintDifferences,
  type FingerprintOptions,
} from './fingerprint'

const base: FingerprintOptions = {
  prefix: 'umber',
  suffix: '',
  hasLabels: true,
  hasLayers: true,
  hasPruning: true,
  hasBaseClass: true,
  hasScope: true,
  hasColorFallbacks: true,
  tokens: '',
}

describe('the fingerprint of the options', () => {
  it('is a short text of every option', () => {
    expect(createFingerprint(base)).toBe('p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=')
    expect(createFingerprint({ ...base, hasLayers: false, suffix: 'a;b', tokens: 'x1' })).toBe(
      'p=umber;x=a%3Bb;l=1;y=0;r=1;b=1;s=1;f=1;t=x1'
    )
  })

  it('says nothing when the two are the same', () => {
    expect(describeFingerprintDifferences(createFingerprint(base), createFingerprint(base))).toBe(
      ''
    )
  })

  it('names every option that differs, with both values', () => {
    const server = createFingerprint({ ...base, prefix: 'a', hasPruning: false, suffix: ';' })
    const message = describeFingerprintDifferences(server, createFingerprint(base))
    expect(message).toContain('prefix (server: a, browser: umber)')
    expect(message).toContain('suffix (server: ;, browser: )')
    expect(message).toContain('hasPruning (server: 0, browser: 1)')
    expect(message).not.toContain('hasLabels')
    expect(message).toMatch(/^UmberStyle: /)
  })

  it('treats an option that a stamp lacks as different', () => {
    const message = describeFingerprintDifferences('p=umber', createFingerprint(base))
    expect(message).toContain('hasScope (server: , browser: 1)')
  })
})
