/** `color` at `opacity` (0 to 1), as a CSS mix with transparent; works with var(--x) colors. */
export function alpha(color: string, opacity: number): string {
  const percent = Math.round(opacity * 10000) / 100
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}
