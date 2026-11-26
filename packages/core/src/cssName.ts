import { codeAt } from './codeAt'

/** What an escape whose code point is not a character stands for: U+FFFD. */
const REPLACEMENT = 0xfffd

/**
 * Whether the code point `code` can be in a name of CSS (an identifier) as it is: a letter of either
 * case, a digit, `-`, `_`, or any code point past ASCII. The labels of the classes carry the names of
 * components, so upper-case letters are common.
 */
export function isNameCode(code: number): boolean {
  return (
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2d ||
    code === 0x5f ||
    code >= 0x80
  )
}

/** Whether `code` is a hex digit. */
function isHexCode(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x61 && code <= 0x66) ||
    (code >= 0x41 && code <= 0x46)
  )
}

/** Whether `code` is white space, which ends the hex digits of an escape. */
function isWhiteSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a
}

/** Whether `code`, from the hex digits of an escape, is a character: not zero, not half of a pair, not past the last one. */
function isCharacter(code: number): boolean {
  return code !== 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
}

/**
 * The character of the escape whose backslash is right before `at` in `text`, and the index after the
 * escape: up to six hex digits and one white space after them, else the next unit as it is.
 */
function readEscape(text: string, at: number): [character: string, end: number] {
  let end = at
  while (end < at + 6 && isHexCode(codeAt(text, end))) end++
  if (end === at) return [text.charAt(at), at + 1]
  const code = Number.parseInt(text.slice(at, end), 16)
  if (isWhiteSpace(codeAt(text, end))) end++
  return [String.fromCodePoint(isCharacter(code) ? code : REPLACEMENT), end]
}

/**
 * The name (an identifier of CSS) that starts at `from` in `text`, with its escapes read, as the name
 * of a class on an element or of a variable is written; and the index after it. A browser writes an
 * escape in the text of a rule for a character that a name cannot hold as it is.
 */
export function readName(text: string, from: number): [name: string, end: number] {
  let name = ''
  let end = from
  while (end < text.length) {
    const code = codeAt(text, end)
    if (code === 0x5c) {
      const [character, after] = readEscape(text, end + 1)
      name += character
      end = after
    } else if (isNameCode(code)) {
      name += text[end]
      end++
    } else break
  }
  return [name, end]
}

/** Whether `code` is a character that a label keeps in a class name: `a-z`, `A-Z`, `0-9`, `_` or `-`. */
function isLabelCode(code: number): boolean {
  return (
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2d ||
    code === 0x5f
  )
}

/**
 * The part of a class name that `label` becomes: white space at its start and end is trimmed, then each
 * code point that is not `a-z`, `A-Z`, `0-9`, `_` or `-` becomes `-`, one for one. A label that is empty
 * once trimmed is ''. A class name made this way needs no escape in a selector, an attribute or a reader.
 */
export function toLabelPart(label: string): string {
  let part = ''
  for (const character of label.trim()) {
    part += isLabelCode(codeAt(character, 0)) ? character : '-'
  }
  return part
}
