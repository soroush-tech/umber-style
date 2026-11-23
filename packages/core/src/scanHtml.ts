import { codeAt } from './codeAt'

/** The class tokens of a finished HTML document. */
export interface HtmlTokens {
  /** The tokens of every `class` (and `className`) attribute. */
  classes: Set<string>
  /** The tokens of every `data-href` attribute: the keys of the `<style href precedence>` elements the document already carries. */
  carried: Set<string>
  /**
   * The ids of the sets of global rules that the markers of `Global` name: the `content` of a
   * `<meta name="<prefix>-global">` (React) and the text after the first word of a comment
   * `<!--<prefix>-global ...-->` (Vue).
   */
  rendered: Set<string>
}

/** The end of the name of a marker of global rules: `<prefix>-global`. */
const MARKER_END = '-global'

/** What a marker of global rules says: its name, `<prefix>-global`, and the ids of the sets, separated by spaces. */
export interface GlobalMarker {
  /** `<prefix>-global`: the name of the `<meta>` element, or the first word of the comment. */
  name: string
  /** The ids of the sets of global rules, separated by spaces. */
  ids: string
}

/**
 * The marker by which a `Global` that renders no style element names its sets in the markup of a server
 * render, so that `extractPageStyles` puts them in that page only: the sets that have rules, by id. None
 * when no set has a rule. A binding renders it as `<meta name="<name>" content="<ids>">` (React) or as a
 * comment `<!--<name> <ids>-->` (Vue).
 */
export function createGlobalMarker(
  prefix: string,
  sets: readonly { id: string; rules: readonly string[] }[]
): GlobalMarker | undefined {
  const ids = sets.filter(({ rules }) => rules.length > 0).map(({ id }) => id)
  return ids.length === 0 ? undefined : { name: `${prefix}${MARKER_END}`, ids: ids.join(' ') }
}

/** The elements whose content is text, not markup: nothing in them is an attribute. */
const RAW_TEXT_ELEMENTS = ['script', 'style', 'textarea', 'title']

/** The tags that the scan reads by name: the `<meta>` of a marker, and the raw text elements. */
const TAG_NAMES = ['meta', ...RAW_TEXT_ELEMENTS]

/** The attributes that the scan reads. */
const ATTRIBUTE_NAMES = ['class', 'classname', 'data-href', 'name', 'content']

/**
 * The one of `words` (each in lower case) that the name from `start` to `end` of `html` is in any case,
 * or undefined: what comparing its `toLowerCase()` with each word gives, without making the name. Only
 * ASCII capitals are lowered here; no other character lowers to a letter of these words.
 */
function findWord(
  html: string,
  start: number,
  end: number,
  words: readonly string[]
): string | undefined {
  return words.find((word) => {
    if (word.length !== end - start) return false
    for (let index = 0; index < word.length; index++) {
      const code = codeAt(html, start + index)
      const lower = code >= 65 && code <= 90 ? code + 32 : code
      if (lower !== word.codePointAt(index)) return false
    }
    return true
  })
}

/** Whether `code` is whitespace in HTML: tab, line feed, vertical tab, form feed, carriage return, space. */
function isSpace(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13)
}

/** Whether `code` ends an attribute name: whitespace, '=', '>' or '/'. */
function isNameEnd(code: number): boolean {
  return isSpace(code) || code === 61 || code === 62 || code === 47
}

/** Whether `code` is an ASCII letter. */
function isLetter(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90)
}

/** The index of the first character at or after `index` that is not whitespace. */
function skipSpaces(html: string, index: number): number {
  let position = index
  while (position < html.length && isSpace(codeAt(html, position))) position++
  return position
}

/** A character other than a space or a printable ASCII one: one character, so nothing to backtrack. */
const OTHER_CHARACTER = /[^ -~]/

/** Adds the whitespace-separated tokens of `value` to `target`. */
function addTokens(target: Set<string>, value: string): void {
  if (OTHER_CHARACTER.test(value)) {
    for (const token of value.split(/\s+/)) {
      if (token !== '') target.add(token)
    }
    return
  }
  // In printable ASCII the space is the only white space: the value is cut at each one, as the split
  // above would cut it, without making the list.
  let start = 0
  for (let space = value.indexOf(' '); space !== -1; space = value.indexOf(' ', start)) {
    if (space > start) target.add(value.slice(start, space))
    start = space + 1
  }
  if (start < value.length) target.add(value.slice(start))
}

/** The value that starts at `index` (quoted with ' or ", or bare) and the index after it. */
function readValue(html: string, index: number): { value: string; end: number } {
  const quote = html[index]
  if (quote === '"' || quote === "'") {
    const close = html.indexOf(quote, index + 1)
    const end = close === -1 ? html.length : close
    return { value: html.slice(index + 1, end), end: end + 1 }
  }
  let end = index
  while (end < html.length && !isSpace(codeAt(html, end)) && html[end] !== '>') end++
  return { value: html.slice(index, end), end }
}

/** Adds the ids that a marker names to `found`: the tokens of `content` when `name` is that of a marker. */
function addMarked(found: HtmlTokens, name: string, content: string): void {
  if (name.endsWith(MARKER_END)) addTokens(found.rendered, content)
}

/** The `name` and the `content` attributes of a tag, kept for the marker of global rules that a `<meta>` is. */
interface MetaAttributes {
  name: string
  content: string
}

/**
 * Adds what the attribute `name` with `value` says to `found`, or keeps it in `meta`. A class value read
 * before (in `classValues`) added its tokens then: many elements of a page carry the same classes.
 */
function addAttribute(
  found: HtmlTokens,
  meta: MetaAttributes,
  name: string,
  value: string,
  classValues: Set<string>
): void {
  if (name === 'class' || name === 'classname') {
    if (classValues.has(value)) return
    classValues.add(value)
    addTokens(found.classes, value)
  } else if (name === 'data-href') addTokens(found.carried, value)
  else if (name === 'name') meta.name = value
  // The last of `ATTRIBUTE_NAMES`.
  else meta.content = value
}

/** Reads the attribute that starts at `index`, adds what matters to `found` or `meta`, and returns the index after it. */
function readAttribute(
  html: string,
  index: number,
  found: HtmlTokens,
  meta: MetaAttributes,
  classValues: Set<string>
): number {
  let position = readNameEnd(html, index)
  if (position === index) position++
  const name = findWord(html, index, position, ATTRIBUTE_NAMES)
  position = skipSpaces(html, position)
  if (html[position] !== '=') return position
  const { value, end } = readValue(html, skipSpaces(html, position + 1))
  if (name !== undefined) addAttribute(found, meta, name, value, classValues)
  return end
}

/** Reads the attributes of the tag whose name ended at `index`, adds what matters to `found`, and returns the index after the `>`. A `<meta>` (`isMeta`) is read for the marker of global rules too. */
function readAttributes(
  html: string,
  index: number,
  found: HtmlTokens,
  isMeta: boolean,
  classValues: Set<string>
): number {
  const meta: MetaAttributes = { name: '', content: '' }
  let position = index
  while (position < html.length) {
    const code = codeAt(html, position)
    if (code === 62) {
      if (isMeta) addMarked(found, meta.name, meta.content)
      return position + 1
    }
    position =
      isSpace(code) || code === 47
        ? position + 1
        : readAttribute(html, position, found, meta, classValues)
  }
  return html.length
}

/** Reads the comment whose text starts at `start` and ends at `end`: a marker of global rules adds the ids it names to `found`. */
function readComment(html: string, start: number, end: number, found: HtmlTokens): void {
  if (!isLetter(codeAt(html, start))) return
  const text = html.slice(start, end)
  const space = text.indexOf(' ')
  if (space !== -1) addMarked(found, text.slice(0, space), text.slice(space + 1))
}

/** The index of the `</name` that closes a raw text element, or the end of the document. */
function findClosingTag(html: string, index: number, name: string): number {
  let position = html.indexOf('</', index)
  while (
    position !== -1 &&
    html.slice(position + 2, position + 2 + name.length).toLowerCase() !== name
  ) {
    position = html.indexOf('</', position + 2)
  }
  return position === -1 ? html.length : position
}

/** The index of the end of the name (of a tag or an attribute) that starts at `index`. */
function readNameEnd(html: string, index: number): number {
  let end = index
  while (end < html.length && !isNameEnd(codeAt(html, end))) end++
  return end
}

/**
 * The class tokens of `html`: the values of the `class` and `className` attributes, in one pass over
 * the markup, with the keys of the style elements it carries (`data-href`) and the ids that the markers
 * of `Global` name. Comments other than a marker and the content of `script`, `style`, `textarea` and
 * `title` are skipped, so a class name inside a script or a text is not taken for a class. Quoted and
 * bare values are read; a class name in any other attribute is not looked at. The pass moves forward
 * only: its time is linear in the length of the document, and there is no pattern to backtrack.
 */
export function scanHtml(html: string): HtmlTokens {
  const found: HtmlTokens = { classes: new Set(), carried: new Set(), rendered: new Set() }
  const classValues = new Set<string>()
  let position = html.indexOf('<')
  while (position !== -1) {
    if (html.startsWith('<!--', position)) {
      const close = html.indexOf('-->', position + 4)
      const end = close === -1 ? html.length : close
      readComment(html, position + 4, end, found)
      position = end + 3
    } else if (isLetter(codeAt(html, position + 1))) {
      const nameEnd = readNameEnd(html, position + 1)
      const name = findWord(html, position + 1, nameEnd, TAG_NAMES)
      position = readAttributes(html, nameEnd, found, name === 'meta', classValues)
      if (name !== undefined && name !== 'meta') position = findClosingTag(html, position, name)
    } else {
      position++
    }
    position = html.indexOf('<', position)
  }
  return found
}
