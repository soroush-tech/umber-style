const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** `color` at `opacity` (0 to 1) as rgba(); only #rgb and #rrggbb change, any other string is returned as it is. */
export function alpha(color: string, opacity: number): string {
  if (!HEX_PATTERN.test(color)) return color
  const digits = color.slice(1)
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
  const [red, green, blue] = [0, 2, 4].map((start) =>
    Number.parseInt(full.slice(start, start + 2), 16)
  )
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}
