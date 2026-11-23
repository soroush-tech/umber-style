import {
  compareVersions,
  isPlaceholder,
  parseVersion,
  pickBaselineTag,
  planReport,
  type Version,
} from './releases'

const parse = (text: string): Version => parseVersion(text) as Version

describe('parseVersion', () => {
  it('splits a version into numbers and prerelease identifiers', () => {
    expect(parseVersion('0.3.0-rc.1')).toEqual({
      major: 0,
      minor: 3,
      patch: 0,
      prerelease: ['rc', 1],
      text: '0.3.0-rc.1',
    })
    expect(parseVersion('12.0.4')).toMatchObject({ major: 12, patch: 4, prerelease: [] })
  })

  it('is undefined for a text that is not a version', () => {
    for (const text of ['latest', '1.0', 'v1.0.0', '1.0.0-', '1.0.0+build']) {
      expect(parseVersion(text)).toBeUndefined()
    }
  })
})

describe('compareVersions', () => {
  it('orders versions as semantic versioning does', () => {
    const ordered = [
      '0.0.0-stage',
      '0.0.0',
      '0.1.0-alpha.2',
      '0.1.0-alpha.10',
      '0.1.0-alpha.beta',
      '0.1.0-rc',
      '0.1.0-rc.0',
      '0.1.0-rc.1',
      '0.1.0',
      '0.1.1',
      '0.2.0',
      '1.0.0',
    ]
    const shuffled = [...ordered].reverse().map(parse)
    expect(shuffled.sort(compareVersions).map(({ text }) => text)).toEqual(ordered)
    expect(compareVersions(parse('0.2.0-rc.1'), parse('0.2.0-rc.1'))).toBe(0)
    expect(compareVersions(parse('0.2.0-1'), parse('0.2.0-alpha'))).toBeLessThan(0)
    expect(compareVersions(parse('0.2.0-alpha'), parse('0.2.0-1'))).toBeGreaterThan(0)
    expect(compareVersions(parse('0.2.0-rc.0'), parse('0.2.0-alpha.9'))).toBeGreaterThan(0)
  })
})

describe('isPlaceholder', () => {
  it('is true for 0.0.0 and its prereleases only', () => {
    expect(isPlaceholder(parse('0.0.0'))).toBe(true)
    expect(isPlaceholder(parse('0.0.0-stage'))).toBe(true)
    expect(isPlaceholder(parse('0.0.1'))).toBe(false)
  })
})

describe('pickBaselineTag', () => {
  const tags = [
    '@umber-style/core@0.1.0-rc.2',
    '@umber-style/core@0.2.0',
    '@umber-style/core@0.1.0',
    '@umber-style/core@0.3.0-rc.0',
    '@umber-style/core@0.0.0',
    '@umber-style/core@nightly',
    '@umber-style/core-extra@9.0.0',
    '@umber-style/react@0.4.0',
  ]

  it('takes the last stable tag of the package', () => {
    expect(pickBaselineTag(tags, '@umber-style/core', 'stable')).toBe('@umber-style/core@0.2.0')
  })

  it('takes a release candidate too when it is the newest and newest is asked for', () => {
    expect(pickBaselineTag(tags, '@umber-style/core', 'newest')).toBe(
      '@umber-style/core@0.3.0-rc.0'
    )
    expect(
      pickBaselineTag(['umber-style@1.0.0-alpha.1', 'umber-style@0.9.0'], 'umber-style', 'newest')
    ).toBe('umber-style@0.9.0')
  })

  it('is undefined when the package has no release tag', () => {
    expect(pickBaselineTag(['@umber-style/core@0.0.0'], '@umber-style/core', 'stable')).toBe(
      undefined
    )
    expect(pickBaselineTag([], '@umber-style/core', 'newest')).toBeUndefined()
  })
})

describe('planReport', () => {
  const registry = [
    '0.0.0-stage',
    '0.0.0',
    '0.1.0-alpha.0',
    '0.1.0-rc.0',
    '0.1.0-rc.1',
    '0.1.0-rc.2',
    '0.1.0',
    '0.2.0-alpha.0',
    '0.2.0-alpha.1',
    '0.2.0',
  ]
  const versionsOf = (plan: ReturnType<typeof planReport>) =>
    plan.compared.map(({ version }) => version)

  it('compares a release candidate with the previous one of its version and the last stable', () => {
    const available = [...registry, '0.3.0-alpha.0', '0.3.0-rc.0', '0.3.0-rc.1']
    expect(planReport(available, '0.3.0-rc.1')).toEqual({
      published: '0.3.0-rc.1',
      compared: [
        { version: '0.2.0', role: 'last stable' },
        { version: '0.3.0-rc.0', role: 'previous rc' },
      ],
      baseline: '0.2.0',
    })
  })

  it('compares an alpha with the previous alpha of its version and the last stable', () => {
    expect(planReport(registry, '0.2.0-alpha.1')).toEqual({
      published: '0.2.0-alpha.1',
      compared: [
        { version: '0.1.0', role: 'last stable' },
        { version: '0.2.0-alpha.0', role: 'previous alpha' },
      ],
      baseline: '0.1.0',
    })
  })

  it('takes the highest of the channel that exists below the published one', () => {
    const available = [...registry, '0.3.0-rc.0', '0.3.0-rc.1', '0.3.0-rc.3']
    expect(versionsOf(planReport(available, '0.3.0-rc.3'))).toEqual(['0.2.0', '0.3.0-rc.1'])
  })

  it('compares the first prerelease of its channel with the last stable only, never with another channel', () => {
    const available = [...registry, '0.3.0-alpha.3', '0.3.0-alpha.4', '0.3.0-rc.0']
    expect(planReport(available, '0.3.0-rc.0')).toEqual({
      published: '0.3.0-rc.0',
      compared: [{ version: '0.2.0', role: 'last stable' }],
      baseline: '0.2.0',
    })
    expect(versionsOf(planReport([...registry, '0.3.0-alpha.0'], '0.3.0-alpha.0'))).toEqual([
      '0.2.0',
    ])
  })

  it('compares a stable release with the previous stable only, not with its release candidates', () => {
    expect(planReport([...registry, '0.3.0-rc.1', '0.3.0'], '0.3.0')).toEqual({
      published: '0.3.0',
      compared: [{ version: '0.2.0', role: 'last stable' }],
      baseline: '0.2.0',
    })
    expect(versionsOf(planReport(registry, '0.2.0'))).toEqual(['0.1.0'])
  })

  it('reads the registry in any order', () => {
    const shuffled = ['0.2.0', '0.1.0-rc.0', '0.2.0-alpha.1', '0.1.0', '0.2.0-alpha.0', '0.0.0']
    expect(versionsOf(planReport(shuffled, '0.2.0-alpha.1'))).toEqual(['0.1.0', '0.2.0-alpha.0'])
  })

  it('compares a package that has no stable yet with the previous release of the channel only', () => {
    expect(planReport(registry, '0.1.0-rc.2')).toEqual({
      published: '0.1.0-rc.2',
      compared: [{ version: '0.1.0-rc.1', role: 'previous rc' }],
      baseline: '0.1.0-rc.1',
    })
  })

  it('has nothing to compare for a first release: a placeholder is never compared', () => {
    expect(planReport(['0.0.0-stage', '0.0.0', '0.1.0-alpha.0'], '0.1.0-alpha.0')).toEqual({
      published: '0.1.0-alpha.0',
      compared: [],
      baseline: undefined,
    })
    expect(planReport(['0.0.0', '0.1.0-alpha.3'], '0.1.0-rc.0').compared).toEqual([])
    expect(planReport([], '1.0.0').baseline).toBeUndefined()
  })

  it('leaves out what is not a version, and what came after the published version', () => {
    expect(
      versionsOf(planReport(['latest', '0.1.0', '0.3.0', '0.2.0-rc.0', '0.2.0-rc.4'], '0.2.0-rc.1'))
    ).toEqual(['0.1.0', '0.2.0-rc.0'])
  })

  it('throws when the published version is not a version', () => {
    expect(() => planReport(registry, 'next')).toThrow('"next" is not a version.')
  })
})
