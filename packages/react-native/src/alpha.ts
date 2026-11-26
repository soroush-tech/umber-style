import { assertAlphaInput, toRgba } from '@umber-style/core/internal'

/**
 * `color` at `opacity` (0 to 1), as one color string: `rgba(r, g, b, a)` for a literal the core can
 * read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with numbers), any other color as
 * it is. 1 returns `color` and 0 returns `transparent`. Throws what the web `alpha` throws: a `TypeError`
 * for a color that is not a string or an opacity that is not a number, a `RangeError` for an opacity
 * outside 0 to 1.
 */
export function alpha(color: string, opacity: number): string {
  assertAlphaInput(color, opacity)
  if (opacity === 1) return color
  if (opacity === 0) return 'transparent'
  return toRgba(color, opacity) ?? color
}
