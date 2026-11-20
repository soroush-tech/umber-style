import { isAlphaColor, type AlphaColor } from './alpha'
import type { KeyframesInput } from './keyframes'
import { mergeStyles, type StyleObject, type StyleValue } from './serialize'
import { isSheetEntry, readEntrySource } from './sheetEntry'

/** The character that stands for an interpolation in the joined text of a template: CSS never holds it. */
const HOLE = '\0'

/**
 * After an interpolation that starts a statement: a newline before anything but spaces and a line
 * comment, then a character that does not go on with a selector or a property name. The interpolation is
 * then a statement of its own, as `${mixin}` alone on its line is.
 */
const OWN_LINE = /[^\S\n]*(?:\/\/.*)?\n\s*[^\s{,:>+~]/y

/** A piece of a template's text: static text, or the index of an interpolation. */
type Piece = string | number

/** Text of a template: final when it holds no interpolation, else its pieces (static text trimmed at both ends). */
type Text = string | Piece[]

/** A declaration: its style key (camelCase already when it holds no interpolation) and its value. */
interface Declaration {
  key: Text
  value: Text
}

/** A nested rule or at-rule: its prelude (a selector, `@media (...)`) and what it holds. */
interface Block {
  prelude: Text
  body: TemplateNode[]
}

/** A statement: a declaration, a block, or an interpolation alone between declarations (its index). */
type TemplateNode = number | Declaration | Block

// The statements of each template, by its strings: a call site of a tagged template always passes the
// same strings array, so its text is split once, and each call only fills in the values.
const templates = new WeakMap<readonly string[], TemplateNode[]>()

/** Throws the `TypeError` of a template that cannot be read: `problem`, with the line and the text around `at`. */
function fail(text: string, at: number, problem: string): never {
  const line = text.slice(0, at).split('\n').length
  const around = text
    .slice(Math.max(0, at - 30), at + 10)
    .replaceAll(HOLE, `\${}`)
    .replace(/\s+/g, ' ')
    .trim()
  throw new TypeError(`parseStyleTemplate(): ${problem} at line ${line}: "${around}"`)
}

/** The style key of a CSS property name: camelCase (`-webkit-x` is `WebkitX`, written back as it was); a custom property as it is. */
function toKey(name: string): string {
  if (name.startsWith('--')) return name
  return name.toLowerCase().replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

/** `pieces` as one text: adjacent static text joined, trimmed at both ends; a string when no interpolation is left. */
function join(pieces: readonly Piece[]): Text {
  const joined: Piece[] = []
  let text = ''
  for (const piece of pieces) {
    if (typeof piece === 'string') text += piece
    else {
      joined.push(text, piece)
      text = ''
    }
  }
  joined.push(text)
  // The list alternates text and indexes, and starts and ends with text.
  joined[0] = (joined[0] as string).trimStart()
  joined[joined.length - 1] = (joined[joined.length - 1] as string).trimEnd()
  return joined.length === 1 ? (joined[0] as string) : joined.filter((piece) => piece !== '')
}

/**
 * The statements of `text`, a template's strings joined with `HOLE`. Outside strings and comments a run
 * of whitespace is one space; a comment is a space; the holes in a comment are skipped.
 */
function parse(text: string): TemplateNode[] {
  const root: TemplateNode[] = []
  const open: [parent: TemplateNode[], at: number][] = []
  let body = root
  // The statement being read: its pieces, the text not yet in them, and where its first ':' is.
  let pieces: Piece[] = []
  let chunk = ''
  let split = -1
  let hole = 0
  let depth = 0
  let parenAt = 0

  const flush = (): void => {
    if (pieces.length > 0 || chunk.trim()) pieces.push(chunk)
    chunk = ''
  }
  const space = (): void => {
    if (!chunk.endsWith(' ')) chunk += ' '
  }
  const skip = (from: number, to: number): void => {
    hole += text.slice(from, to).split(HOLE).length - 1
  }
  const end = (at: number): void => {
    flush()
    if (split >= 0) {
      const key = join(pieces.slice(0, split))
      if (key === '') fail(text, at, 'a declaration without a property')
      body.push({
        key: typeof key === 'string' ? toKey(key) : key,
        value: join(pieces.slice(split + 1)),
      })
    } else {
      for (const piece of pieces) {
        if (typeof piece === 'number') body.push(piece)
        else if (piece.trim()) fail(text, at, 'a declaration without ":"')
      }
    }
    pieces = []
    split = -1
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === HOLE) {
      flush()
      pieces.push(hole++)
      if (pieces.length === 1) {
        OWN_LINE.lastIndex = index + 1
        if (OWN_LINE.test(text)) end(index)
      }
    } else if (char === '"' || char === "'") {
      const at = index
      chunk += char
      for (index++; text[index] !== char; index++) {
        if (index >= text.length) fail(text, at, 'an unclosed string')
        if (text[index] === HOLE) {
          flush()
          pieces.push(hole++)
        } else {
          // An escape keeps the next character, unless it is a hole: `HOLE` and past the end are not above it.
          if (text[index] === '\\' && text[index + 1] > HOLE) chunk += text[index++]
          chunk += text[index]
        }
      }
      chunk += char
    } else if (char === '\\') {
      chunk += char
      if (text[index + 1] > HOLE) chunk += text[++index]
    } else if (char === '/' && text[index + 1] === '*') {
      const close = text.indexOf('*/', index + 2)
      if (close < 0) fail(text, index, 'an unclosed comment')
      skip(index, close)
      index = close + 1
      space()
    } else if (char === '/' && text[index + 1] === '/' && depth === 0) {
      // A line comment, outside parentheses only: `url(http://x)` is not one.
      const stop = text.indexOf('\n', index)
      const close = stop < 0 ? text.length : stop
      skip(index, close)
      index = close - 1
    } else if (char <= ' ') {
      space()
    } else if (depth > 0 || char === '(') {
      if (char === '(' && depth++ === 0) parenAt = index
      else if (char === ')') depth--
      chunk += char
    } else if (char === ':' && split < 0) {
      flush()
      split = pieces.length
      pieces.push(':')
    } else if (char === ';') {
      end(index)
    } else if (char === '{') {
      flush()
      const prelude = join(pieces)
      if (prelude === '') fail(text, index, 'a block without a selector')
      const block: Block = { prelude, body: [] }
      body.push(block)
      open.push([body, index])
      body = block.body
      pieces = []
      split = -1
    } else if (char === '}') {
      end(index)
      const parent = open.pop()
      if (!parent) fail(text, index, 'a "}" without a "{"')
      body = parent[0]
    } else {
      chunk += char
    }
  }
  if (depth > 0) fail(text, parenAt, 'an unclosed "("')
  end(text.length)
  const unclosed = open.pop()
  if (unclosed) fail(text, unclosed[1], 'an unclosed block')
  return root
}

/** Whether `value` is a function of the props: not one that prints as text of its own (a stand-in for the theme, a component that is a selector). */
function isCallable(value: unknown): value is (props: unknown) => unknown {
  return typeof value === 'function' && value.toString === Function.prototype.toString
}

/** Whether `value`, or an item of it, is a function of the props. */
function isDynamic(value: unknown): boolean {
  return isCallable(value) || (Array.isArray(value) && value.some(isDynamic))
}

/** `value` with each function called with `props`, until it is not a function. */
function resolve(value: unknown, props: unknown): unknown {
  let resolved = value
  while (isCallable(resolved)) resolved = resolved(props)
  return resolved
}

/** Whether `value` is a plain object, not one with a text of its own (a sheet entry, an `alpha()` result). */
function isPlainObject(value: unknown): value is StyleObject {
  return typeof value === 'object' && value !== null && value.toString === Object.prototype.toString
}

/** An interpolation as text in a value, a selector or a property name. */
function toText(value: unknown, props: unknown): string {
  const resolved = resolve(value, props)
  if (Array.isArray(resolved)) return resolved.map((item) => toText(item, props)).join('')
  if (resolved === null || resolved === undefined || typeof resolved === 'boolean') return ''
  if (isPlainObject(resolved)) {
    throw new TypeError(
      'parseStyleTemplate(): a style object can stand only between declarations, not in a value, a selector or a property name.'
    )
  }
  return String(resolved)
}

/** `text` with its interpolations filled in, trimmed. */
function fill(text: Text, values: readonly unknown[], props: unknown): string {
  if (typeof text === 'string') return text
  let filled = ''
  for (const piece of text)
    filled += typeof piece === 'string' ? piece : toText(values[piece], props)
  return filled.trim()
}

/** A declared value: an `alpha()` result that is the whole value is kept, so that its fallback is written; anything else is text. */
function fillValue(text: Text, values: readonly unknown[], props: unknown): string | AlphaColor {
  if (typeof text === 'string' || text.length > 1) return fill(text, values, props)
  const value = resolve(values[text[0] as number], props)
  return isAlphaColor(value) ? value : toText(value, props).trim()
}

/** Whether `value` is a nested style, not a declared value. */
function isNested(value: StyleValue): value is StyleObject {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !isAlphaColor(value)
  )
}

/**
 * Sets `key` of `style` to `value`, at the end: a nested style is merged into the one before it; a value
 * declared again is added to the one before it as a fallback list, as CSS writes both.
 */
function put(style: StyleObject, key: string, value: StyleObject | string | AlphaColor): void {
  const earlier = style[key]
  delete style[key]
  if (isNested(value)) style[key] = isNested(earlier) ? mergeStyles([earlier, value]) : value
  else if (earlier === undefined || earlier === null || earlier === false || isNested(earlier)) {
    style[key] = value
  } else style[key] = [earlier, value].flat() as StyleValue
}

/** `style` with the interpolation `value` that stands between declarations merged in. */
function include(style: StyleObject, value: unknown, props: unknown): StyleObject {
  const resolved = resolve(value, props)
  if (Array.isArray(resolved)) {
    return resolved.reduce((merged: StyleObject, item) => include(merged, item, props), style)
  }
  if (resolved === null || resolved === undefined || typeof resolved === 'boolean') return style
  if (isSheetEntry(resolved)) {
    const source = readEntrySource(resolved)
    if (!source) {
      throw new TypeError(
        `parseStyleTemplate(): the sheet entry "${resolved.className}" is only a class name, so its style cannot be merged.`
      )
    }
    return mergeStyles([style, source.style])
  }
  if (isPlainObject(resolved)) return mergeStyles([style, resolved])
  return build(parse(String(resolved)), [], props, style)
}

/** The style of `nodes`, with `values` for the interpolations and `props` for the functions among them, added to `style`. */
function build(
  nodes: readonly TemplateNode[],
  values: readonly unknown[],
  props: unknown,
  style: StyleObject = {}
): StyleObject {
  let built = style
  for (const node of nodes) {
    if (typeof node === 'number') built = include(built, values[node], props)
    else if ('body' in node)
      put(built, fill(node.prelude, values, props), build(node.body, values, props))
    else {
      const key = typeof node.key === 'string' ? node.key : toKey(fill(node.key, values, props))
      put(built, key, fillValue(node.value, values, props))
    }
  }
  return built
}

/** Whether `value` is the strings of a tagged template: an array with `raw`, which a call with styles never is. */
export function isTemplateStrings(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

/**
 * The style of a tagged template, `strings` and `values` as a tag is given them: CSS text with
 * declarations, nested rules (`&:hover { }`, `> p { }`), at-rules (`@media (...) { }`) and comments.
 * A value is kept as text (`padding: 8px` is `'8px'`); a property is a camelCase key; a property declared
 * twice in a block is a fallback list. An interpolation in a value, a selector or a property name is
 * text; one alone between declarations is merged in: a style object, a sheet entry, CSS text, or a list
 * of them. `null`, `undefined`, `true` and `false` are nothing. When an interpolation is a function, the
 * result is a function of the props that calls it with them (what it returns is an interpolation too);
 * else it is the style. The text is split once for each `strings` array. Throws a `TypeError` with the
 * text around the place for a template that cannot be read.
 */
export function parseStyleTemplate<P = unknown>(
  strings: readonly string[],
  values: readonly unknown[]
): StyleObject | ((props: P) => StyleObject) {
  const nodes = templates.get(strings) ?? parse(strings.join(HOLE))
  templates.set(strings, nodes)
  return values.some(isDynamic)
    ? (props: P) => build(nodes, values, props)
    : build(nodes, values, undefined)
}

/**
 * The steps of an animation from a tagged template: `from { ... } 50% { ... } to { ... }`, read as
 * `parseStyleTemplate` reads a style. When an interpolation is a function, the result is a function of
 * the theme, and the function is called with `{ theme }`, as a function in a style is.
 */
export function parseKeyframesTemplate<T = unknown>(
  strings: readonly string[],
  values: readonly unknown[]
): KeyframesInput<T> {
  const steps = parseStyleTemplate<{ theme: T }>(strings, values)
  return (typeof steps === 'function' ? (theme: T) => steps({ theme }) : steps) as KeyframesInput<T>
}
