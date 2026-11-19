const VARIABLE_OPEN = 'var('

/** Whether `code` is a character of a variable name: a lowercase letter, a digit, '-' or '_'. */
function isNameCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 95
}

/** The index of the first character at or after `index` that is not whitespace. */
function skipSpaces(text: string, index: number): number {
  let position = index
  while (text.charCodeAt(position) <= 32) position++
  return position
}

/**
 * The names of the variables that `css` refers to and that start with `start` (`--<prefix>-`), in order
 * of appearance, with repeats. A reference may have a fallback, which may refer to others. One pass.
 */
export function scanVariables(css: string, start: string): string[] {
  const names: string[] = []
  let from = css.indexOf(VARIABLE_OPEN)
  while (from !== -1) {
    const begin = skipSpaces(css, from + VARIABLE_OPEN.length)
    let end = begin + start.length
    if (css.startsWith(start, begin)) {
      while (isNameCode(css.charCodeAt(end))) end++
      names.push(css.slice(begin, end))
    }
    from = css.indexOf(VARIABLE_OPEN, begin)
  }
  return names
}
