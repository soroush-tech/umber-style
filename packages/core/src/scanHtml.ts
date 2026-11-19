/** The class tokens of a finished HTML document. */
export interface HtmlTokens {
  /** The tokens of every `class` (and `className`) attribute. */
  classes: Set<string>
  /** The tokens of every `data-href` attribute: the keys of the `<style href precedence>` elements the document already carries. */
  carried: Set<string>
}

/** The elements whose content is text, not markup: nothing in them is an attribute. */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title'])

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
  while (position < html.length && isSpace(html.charCodeAt(position))) position++
  return position
}

/** Adds the whitespace-separated tokens of `value` to `target`. */
function addTokens(target: Set<string>, value: string): void {
  for (const token of value.split(/\s+/)) {
    if (token !== '') target.add(token)
  }
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
  while (end < html.length && !isSpace(html.charCodeAt(end)) && html[end] !== '>') end++
  return { value: html.slice(index, end), end }
}

/** Reads the attributes of the tag whose name ended at `index`, adds what matters to `found`, and returns the index after the `>`. */
function readAttributes(html: string, index: number, found: HtmlTokens): number {
  let position = index
  while (position < html.length) {
    const code = html.charCodeAt(position)
    if (code === 62) return position + 1
    if (isSpace(code) || code === 47) {
      position++
      continue
    }
    const nameStart = position
    while (position < html.length && !isNameEnd(html.charCodeAt(position))) position++
    if (position === nameStart) position++
    const name = html.slice(nameStart, position).toLowerCase()
    position = skipSpaces(html, position)
    if (html[position] !== '=') continue
    const { value, end } = readValue(html, skipSpaces(html, position + 1))
    position = end
    if (name === 'class' || name === 'classname') addTokens(found.classes, value)
    else if (name === 'data-href') addTokens(found.carried, value)
  }
  return html.length
}

/** The index of the `</name` that closes a raw text element, or the end of the document. */
function findClosingTag(html: string, index: number, name: string): number {
  let at = html.indexOf('</', index)
  while (at !== -1 && html.slice(at + 2, at + 2 + name.length).toLowerCase() !== name) {
    at = html.indexOf('</', at + 2)
  }
  return at === -1 ? html.length : at
}

/** The index of the end of the tag name that starts at `index`. */
function readTagNameEnd(html: string, index: number): number {
  let end = index
  while (end < html.length && !isNameEnd(html.charCodeAt(end))) end++
  return end
}

/**
 * The class tokens of `html`: the values of the `class` and `className` attributes, in one pass over
 * the markup. Comments and the content of `script`, `style`, `textarea` and `title` are skipped, so
 * a class name inside a script or a text is not taken for a class. Quoted and bare values are read;
 * a class name in any other attribute is not looked at. The pass moves forward only: its time is
 * linear in the length of the document, and there is no pattern to backtrack.
 */
export function scanHtml(html: string): HtmlTokens {
  const found: HtmlTokens = { classes: new Set(), carried: new Set() }
  let at = html.indexOf('<')
  while (at !== -1) {
    if (html.startsWith('<!--', at)) {
      const close = html.indexOf('-->', at + 4)
      at = close === -1 ? html.length : close + 3
    } else if (isLetter(html.charCodeAt(at + 1))) {
      const nameEnd = readTagNameEnd(html, at + 1)
      const name = html.slice(at + 1, nameEnd).toLowerCase()
      at = readAttributes(html, nameEnd, found)
      if (RAW_TEXT_ELEMENTS.has(name)) at = findClosingTag(html, at, name)
    } else {
      at++
    }
    at = html.indexOf('<', at)
  }
  return found
}
