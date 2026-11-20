/** What a media query is matched against: the window and the system settings. */
export interface WindowState {
  /** The width of the window, in density-independent pixels. */
  readonly width: number
  /** The height of the window, in density-independent pixels. */
  readonly height: number
  /** The system color scheme as the platform reports it; anything but `dark` counts as light. */
  readonly colorScheme: string | null | undefined
  /** Whether the system asks for reduced motion. */
  readonly reducedMotion: boolean
}

/** A media query read once: whether it holds for a window, and what the binding cannot evaluate in it. */
export interface MediaQuery {
  /** Whether the query holds for `state`, a `rem` or `em` length being `remBase` pixels. */
  readonly matches: (state: WindowState, remBase: number) => boolean
  /** What the binding cannot evaluate in the query (`the media feature "hover"`), which then never matches; undefined when it evaluates all of it. */
  readonly problem?: string
}

type Test = (state: WindowState, remBase: number) => boolean
type Operator = '<' | '<=' | '>' | '>=' | '='

/** A part of a query that the binding cannot evaluate: what to name in the warning. */
class Unsupported {
  constructor(readonly problem: string) {}
}

/** A key that is a media query: `@media` and then white space or a parenthesis. */
const MEDIA_KEY = /^@media(?=[\s(])/i
/** `@media` in front of a query, with any white space before it. */
const MEDIA_PREFIX = /^\s*@media(?![a-z-])/i
/** A feature in parentheses, a word, or any other character. */
const TOKEN = /\([^()]*\)|[a-z-]+|\S/g
/** A number and its unit. */
const LENGTH = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/
/** An operator of the range form, with the white space around it. */
const RANGE = /\s*(<=|>=|<|>|=)\s*/
/** The name of a feature, `min-` or `max-` and all. */
const NAME = /^[a-z-]+$/
const SIZE = /^(min-|max-)?(width|height)$/
const SIZE_FEATURES = new Set(['width', 'height'])
const FLIPPED: Record<Operator, Operator> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' }

/** The features that take a keyword, and the test of each keyword. */
const KEYWORD_FEATURES = new Map<string, Map<string, Test>>([
  [
    'orientation',
    new Map<string, Test>([
      ['portrait', (state) => state.height >= state.width],
      ['landscape', (state) => state.height < state.width],
    ]),
  ],
  [
    'prefers-color-scheme',
    new Map<string, Test>([
      ['light', (state) => state.colorScheme !== 'dark'],
      ['dark', (state) => state.colorScheme === 'dark'],
    ]),
  ],
  [
    'prefers-reduced-motion',
    new Map<string, Test>([
      ['reduce', (state) => state.reducedMotion],
      ['no-preference', (state) => !state.reducedMotion],
    ]),
  ],
])

const never: Test = () => false
const always: Test = () => true

/** Whether `key` is a media query key: `@media (...)`. */
export function isMediaKey(key: string): boolean {
  return MEDIA_KEY.test(key)
}

/** `left` compared with `right` by `operator`. */
function compare(left: number, operator: Operator, right: number): boolean {
  switch (operator) {
    case '<':
      return left < right
    case '<=':
      return left <= right
    case '>':
      return left > right
    case '>=':
      return left >= right
    default:
      return left === right
  }
}

/** The length `text` for a `remBase`: `px` and no unit are pixels, `rem` and `em` are `remBase` times their number. */
function readLength(text: string): ((remBase: number) => number) | Unsupported {
  const match = LENGTH.exec(text)
  if (match === null) return new Unsupported(`the value "${text}"`)
  const value = Number.parseFloat(match[1])
  const unit = match[2]
  if (unit === '' || unit === 'px') return () => value
  if (unit === 'rem' || unit === 'em') return (remBase) => value * remBase
  return new Unsupported(`the unit "${unit}"`)
}

/** The test of `feature operator text`: the width or the height of the window compared with a length. */
function compareSize(feature: string, operator: Operator, text: string): Test | Unsupported {
  const length = readLength(text)
  if (length instanceof Unsupported) return length
  return feature === 'width'
    ? (state, remBase) => compare(state.width, operator, length(remBase))
    : (state, remBase) => compare(state.height, operator, length(remBase))
}

/** The test of `(name: value)`. */
function readPlainFeature(name: string, value: string): Test | Unsupported {
  const size = SIZE.exec(name)
  if (size !== null) {
    const operator = size[1] === 'min-' ? '>=' : size[1] === 'max-' ? '<=' : '='
    return compareSize(size[2], operator, value)
  }
  const keywords = KEYWORD_FEATURES.get(name)
  if (keywords === undefined) return new Unsupported(`the media feature "${name}"`)
  return keywords.get(value) ?? new Unsupported(`the value "${value}" of ${name}`)
}

/** The test of a range: `width >= 600px`, `600px <= width`, `400px <= width < 800px`. */
function readRange(parts: string[]): Test | Unsupported {
  if (parts.length === 3) {
    const [left, operator, right] = parts as [string, Operator, string]
    if (SIZE_FEATURES.has(left)) return compareSize(left, operator, right)
    if (SIZE_FEATURES.has(right)) return compareSize(right, FLIPPED[operator], left)
  }
  if (parts.length === 5 && SIZE_FEATURES.has(parts[2])) {
    const [low, first, feature, second, high] = parts as [
      string,
      Operator,
      string,
      Operator,
      string,
    ]
    // Both operators point the same way: `<` and `<=`, or `>` and `>=`.
    if (first !== '=' && second !== '=' && first[0] === second[0]) {
      const above = compareSize(feature, FLIPPED[first], low)
      const below = compareSize(feature, second, high)
      if (above instanceof Unsupported) return above
      if (below instanceof Unsupported) return below
      return (state, remBase) => above(state, remBase) && below(state, remBase)
    }
  }
  const name = parts.find((part) => NAME.test(part) && !SIZE_FEATURES.has(part))
  return new Unsupported(
    name === undefined ? `the range "${parts.join(' ')}"` : `the media feature "${name}"`
  )
}

/** The test of the text inside one pair of parentheses. */
function readFeature(text: string): Test | Unsupported {
  const colon = text.indexOf(':')
  if (colon >= 0) return readPlainFeature(text.slice(0, colon).trim(), text.slice(colon + 1).trim())
  const parts = text.split(RANGE)
  if (parts.length > 1) return readRange(parts)
  return new Unsupported(NAME.test(text) ? `the media feature "${text}"` : `the text "(${text})"`)
}

/** Whether `token` is a feature in parentheses. */
const isFeature = (token: string | undefined): token is string =>
  token !== undefined && token.length > 1 && token[0] === '('

/** The test of one query of a list: `not` or `only`, a media type, and features joined by `and`. */
function readQuery(text: string): Test | Unsupported {
  const tokens = text.match(TOKEN) ?? []
  const invalid = new Unsupported(`the text "${text}"`)
  const isNegated = tokens[0] === 'not'
  let index = isNegated || tokens[0] === 'only' ? 1 : 0
  const type = tokens[index]
  if (type !== undefined && NAME.test(type)) {
    if (type !== 'all' && type !== 'screen') return new Unsupported(`the media type "${type}"`)
    index++
    if (index === tokens.length) return isNegated ? never : always
    if (tokens[index++] !== 'and') return invalid
  }
  const tests: Test[] = []
  for (;;) {
    const token = tokens[index++]
    if (!isFeature(token)) return invalid
    const test = readFeature(token.slice(1, -1).trim())
    if (test instanceof Unsupported) return test
    tests.push(test)
    if (index === tokens.length) break
    if (tokens[index++] !== 'and') return invalid
  }
  return (state, remBase) => tests.every((test) => test(state, remBase)) !== isNegated
}

/** `text` read as a media query list, with or without `@media` in front. */
function parseMediaQuery(text: string): MediaQuery {
  const list = text.replace(MEDIA_PREFIX, '').trim().toLowerCase()
  const tests: Test[] = []
  for (const part of list.split(',')) {
    const test = readQuery(part.trim())
    if (test instanceof Unsupported) return { matches: never, problem: test.problem }
    tests.push(test)
  }
  return { matches: (state, remBase) => tests.some((test) => test(state, remBase)) }
}

const queries = new Map<string, MediaQuery>()

/**
 * The media query `text` (a key `@media (...)`, or the query alone, as `matchMedia` takes it), read once
 * for each text. The subset: `width`, `height` and their `min-` and `max-` forms, the range forms
 * (`width >= 600px`, `600px <= width`, `400px <= width < 800px`), `orientation`, `prefers-color-scheme`
 * and `prefers-reduced-motion`, joined by `and`, in a comma list (any one matches), after `not` or
 * `only` and the media type `all` or `screen`. A length is in `px` or has no unit (one pixel is one
 * density-independent pixel), or is in `rem` or `em` (`remBase` pixels). A query with anything else
 * never matches, and has a `problem` that names it.
 */
export function readMediaQuery(text: string): MediaQuery {
  let query = queries.get(text)
  if (query === undefined) {
    query = parseMediaQuery(text)
    queries.set(text, query)
  }
  return query
}
