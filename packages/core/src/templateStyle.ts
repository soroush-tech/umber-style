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
  joined[joined.length - 1] = (joined.at(-1) as string).trimEnd()
  return joined.length === 1 ? (joined[0] as string) : joined.filter((piece) => piece !== '')
}

/** Where `parse` is in a template's text: the statements made so far, and the statement being read. */
interface ParseState {
  /** The template's strings joined with `HOLE`. */
  readonly text: string
  /** The blocks that are open, each with the statements it was opened in and where its `{` is. */
  readonly open: [parent: TemplateNode[], at: number][]
  /** The statements of the innermost open block (of the template, at the top). */
  body: TemplateNode[]
  // The statement being read: its pieces, the text not yet in them, and where its first ':' is.
  pieces: Piece[]
  chunk: string
  split: number
  /** The index of the next interpolation. */
  hole: number
  /** How many parentheses are open, and where the outermost one opened. */
  depth: number
  parenAt: number
}

/** Ends the text not yet in the pieces of the statement: it becomes a piece unless it is only whitespace at the start. */
function flush(state: ParseState): void {
  if (state.pieces.length > 0 || state.chunk.trim()) state.pieces.push(state.chunk)
  state.chunk = ''
}

/** Adds a space to the statement, unless it already ends with one. */
function space(state: ParseState): void {
  if (!state.chunk.endsWith(' ')) state.chunk += ' '
}

/** Counts the holes from `from` to `to` as read: they are in a comment, and stand for nothing. */
function skip(state: ParseState, from: number, to: number): void {
  state.hole += state.text.slice(from, to).split(HOLE).length - 1
}

/** Adds the next interpolation to the pieces of the statement. */
function addHole(state: ParseState): void {
  flush(state)
  state.pieces.push(state.hole++)
}

/** Adds the declaration that was read to the block: the pieces before its first ':' are its key, the rest its value. */
function endDeclaration(state: ParseState, at: number): void {
  const key = join(state.pieces.slice(0, state.split))
  if (key === '') fail(state.text, at, 'a declaration without a property')
  state.body.push({
    key: typeof key === 'string' ? toKey(key) : key,
    value: join(state.pieces.slice(state.split + 1)),
  })
}

/** Adds the interpolations that were read without a ':' to the block, each a statement of its own; any other text is a declaration without one. */
function endInterpolations(state: ParseState, at: number): void {
  for (const piece of state.pieces) {
    if (typeof piece === 'number') state.body.push(piece)
    else if (piece.trim()) fail(state.text, at, 'a declaration without ":"')
  }
}

/** Ends the statement being read at `at`, and starts the next one. */
function end(state: ParseState, at: number): void {
  flush(state)
  if (state.split >= 0) endDeclaration(state, at)
  else endInterpolations(state, at)
  state.pieces = []
  state.split = -1
}

/** Reads the interpolation at `index`; one that starts a statement and stands on its own line ends it. Returns the index after it. */
function readHole(state: ParseState, index: number): number {
  addHole(state)
  if (state.pieces.length === 1) {
    OWN_LINE.lastIndex = index + 1
    if (OWN_LINE.test(state.text)) end(state, index)
  }
  return index + 1
}

/** Copies the character at `index` into the statement, and the next one when it is an escape: `HOLE` and past the end are not above it, so a hole is not kept. Returns the index after them. */
function readEscaped(state: ParseState, index: number): number {
  const { text } = state
  const length = text[index] === '\\' && text[index + 1] > HOLE ? 2 : 1
  state.chunk += text.slice(index, index + length)
  return index + length
}

/** Reads the string that starts at `index`, with the interpolations in it. Returns the index after its closing quote. */
function readString(state: ParseState, index: number): number {
  const { text } = state
  const quote = text[index]
  state.chunk += quote
  let at = index + 1
  while (text[at] !== quote) {
    if (at >= text.length) fail(text, index, 'an unclosed string')
    if (text[at] === HOLE) {
      addHole(state)
      at++
    } else {
      at = readEscaped(state, at)
    }
  }
  state.chunk += quote
  return at + 1
}

/** Reads the comment that starts at `index`: it is a space. Returns the index after its `*` and `/`. */
function readComment(state: ParseState, index: number): number {
  const close = state.text.indexOf('*/', index + 2)
  if (close < 0) fail(state.text, index, 'an unclosed comment')
  skip(state, index, close)
  space(state)
  return close + 2
}

/** Reads the line comment that starts at `index`. Returns the index of the newline that ends it, or the end of the text. */
function readLineComment(state: ParseState, index: number): number {
  const stop = state.text.indexOf('\n', index)
  const close = stop < 0 ? state.text.length : stop
  skip(state, index, close)
  return close
}

/** Reads the `/` at `index`: the start of a comment, or a character of the statement. Returns the index after what it read. */
function readSlash(state: ParseState, index: number): number {
  const next = state.text[index + 1]
  if (next === '*') return readComment(state, index)
  // A line comment, outside parentheses only: `url(http://x)` is not one.
  if (next === '/' && state.depth === 0) return readLineComment(state, index)
  state.chunk += '/'
  return index + 1
}

/** Reads `char` at `index` inside parentheses, or the `(` that opens them: it is a character of the statement. */
function readParenthesized(state: ParseState, char: string, index: number): void {
  if (char === '(' && state.depth++ === 0) state.parenAt = index
  else if (char === ')') state.depth--
  state.chunk += char
}

/** Reads the first ':' of a statement: what is before it is the key of a declaration. */
function readColon(state: ParseState): void {
  flush(state)
  state.split = state.pieces.length
  state.pieces.push(':')
}

/** Reads the `{` at `index`: the statement read so far is the prelude of a block, which is open until its `}`. */
function openBlock(state: ParseState, index: number): void {
  flush(state)
  const prelude = join(state.pieces)
  if (prelude === '') fail(state.text, index, 'a block without a selector')
  const block: Block = { prelude, body: [] }
  state.body.push(block)
  state.open.push([state.body, index])
  state.body = block.body
  state.pieces = []
  state.split = -1
}

/** Reads the `}` at `index`: it ends the statement being read and the innermost open block. */
function closeBlock(state: ParseState, index: number): void {
  end(state, index)
  const parent = state.open.pop()
  if (!parent) fail(state.text, index, 'a "}" without a "{"')
  state.body = parent[0]
}

/** Reads `char` at `index`, outside strings, comments and parentheses. */
function readStatementChar(state: ParseState, char: string, index: number): void {
  switch (char) {
    case ':':
      if (state.split < 0) readColon(state)
      else state.chunk += char
      break
    case ';':
      end(state, index)
      break
    case '{':
      openBlock(state, index)
      break
    case '}':
      closeBlock(state, index)
      break
    default:
      state.chunk += char
  }
}

/** Reads `char` at `index`, which starts nothing longer: whitespace, a character in parentheses, or one of a statement. */
function readChar(state: ParseState, char: string, index: number): void {
  if (char <= ' ') space(state)
  else if (state.depth > 0 || char === '(') readParenthesized(state, char, index)
  else readStatementChar(state, char, index)
}

/** Reads what starts at `index`: an interpolation, a string, an escape, a comment, or one character. Returns the index after it. */
function readNext(state: ParseState, index: number): number {
  const char = state.text[index]
  switch (char) {
    case HOLE:
      return readHole(state, index)
    case '"':
    case "'":
      return readString(state, index)
    case '\\':
      return readEscaped(state, index)
    case '/':
      return readSlash(state, index)
    default:
      readChar(state, char, index)
      return index + 1
  }
}

/**
 * The statements of `text`, a template's strings joined with `HOLE`, in one pass. Outside strings and
 * comments a run of whitespace is one space; a comment is a space; the holes in a comment are skipped.
 */
function parse(text: string): TemplateNode[] {
  const root: TemplateNode[] = []
  const state: ParseState = {
    text,
    open: [],
    body: root,
    pieces: [],
    chunk: '',
    split: -1,
    hole: 0,
    depth: 0,
    parenAt: 0,
  }
  let index = 0
  while (index < text.length) index = readNext(state, index)
  if (state.depth > 0) fail(text, state.parenAt, 'an unclosed "("')
  end(state, text.length)
  const unclosed = state.open.pop()
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

/** What an interpolation is once lists, nothing and plain objects are taken out: a value that prints as text of its own. */
type Printable = string | number | bigint | symbol | { toString(): string }

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
  return String(resolved as Printable)
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
  return build(parse(String(resolved as Printable)), [], props, style)
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
  return Array.isArray(value) && Object.hasOwn(value, 'raw')
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
