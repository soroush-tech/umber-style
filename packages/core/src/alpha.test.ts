import { alpha } from './alpha'

describe('alpha', () => {
  it('mixes the color with transparent, also for a variable', () => {
    expect(alpha('var(--ds-palette-primary)', 0.5)).toBe(
      'color-mix(in srgb, var(--ds-palette-primary) 50%, transparent)'
    )
  })

  it('rounds the percent to two decimals', () => {
    expect(alpha('red', 0.12345)).toBe('color-mix(in srgb, red 12.35%, transparent)')
    expect(alpha('red', 1)).toBe('color-mix(in srgb, red 100%, transparent)')
  })
})
