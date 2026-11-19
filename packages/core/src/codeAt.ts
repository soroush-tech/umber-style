/** The code point at `index` of `text`; NaN past the end, so that every comparison with a code is false. */
export function codeAt(text: string, index: number): number {
  return text.codePointAt(index) ?? Number.NaN
}
