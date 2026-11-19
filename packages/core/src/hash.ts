const MULTIPLIER = 0x5bd1e995

/** Multiplies `value` by the hash constant, kept to 32 bits. */
function multiply(value: number): number {
  return (value & 0xffff) * MULTIPLIER + (((value >>> 16) * 0xe995) << 16)
}

/** A short, stable hash of `text`, in base 36. */
export function hashString(text: string): string {
  let hash = 0
  let index = 0
  let remaining = text.length
  const codeAt = (position: number) => (text.codePointAt(position) as number) & 0xff

  for (; remaining >= 4; index += 4, remaining -= 4) {
    let chunk =
      codeAt(index) |
      (codeAt(index + 1) << 8) |
      (codeAt(index + 2) << 16) |
      (codeAt(index + 3) << 24)
    chunk = multiply(chunk)
    chunk ^= chunk >>> 24
    hash = multiply(chunk) ^ multiply(hash)
  }

  if (remaining === 3) hash ^= codeAt(index + 2) << 16
  if (remaining >= 2) hash ^= codeAt(index + 1) << 8
  if (remaining >= 1) hash = multiply(hash ^ codeAt(index))

  hash ^= hash >>> 13
  hash = multiply(hash)
  return ((hash ^ (hash >>> 15)) >>> 0).toString(36)
}
