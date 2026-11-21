/** What a media query is matched against: the window and the system settings. */
export interface WindowState {
  /** The width of the window, in density-independent pixels. */
  readonly width: number
  /** The height of the window, in density-independent pixels. */
  readonly height: number
  /** The system color scheme as the platform reports it; anything but `dark` counts as light. */
  readonly colorScheme: string | null | undefined
  /** Whether the system asks for reduced motion. */
  readonly isReducedMotion: boolean
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

/** What reading a part of a query gives: its test, or what the binding cannot evaluate. */
type Reading = Test | Unsupported
/** A reading, or undefined when the text is not of the form asked for. */
type MaybeReading = Reading | undefined

/** A key that is a media query: `@media` and then white space or a parenthesis. */
const MEDIA_KEY = /^@media(?=[\s(])/i
/** `@media` in front of a query, with any white space before it. */
const MEDIA_PREFIX = /^\s*@media(?![a-z-])/i
/** A feature in parentheses, a word, or any other character. */
const TOKEN = /\([^()]*\)|[a-z-]+|\S/g
/** A number and its unit. */
const LENGTH = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/
/** An operator of the range form. The white space around it is trimmed off the parts: a pattern that took it in would try each run of white space once for each of its characters. */
const RANGE = /(<=|>=|<|>|=)/
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
      ['reduce', (state) => state.isReducedMotion],
      ['no-preference', (state) => !state.isReducedMotion],
    ]),
  ],
])

const matchNever: Test = () => false

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
function compareSize(feature: string, operator: Operator, text: string): Reading {
  const length = readLength(text)
  if (length instanceof Unsupported) return length
  return feature === 'width'
    ? (state, remBase) => compare(state.width, operator, length(remBase))
    : (state, remBase) => compare(state.height, operator, length(remBase))
}

/** The operator of a size feature with the prefix `bound`: `min-` is `>=`, `max-` is `<=`, none is `=`. */
function readBoundOperator(bound: string | undefined): Operator {
  if (bound === 'min-') return '>='
  return bound === 'max-' ? '<=' : '='
}

/** The test of `(name: value)`. */
function readPlainFeature(name: string, value: string): Reading {
  const size = SIZE.exec(name)
  if (size !== null) return compareSize(size[2], readBoundOperator(size[1]), value)
  const keywords = KEYWORD_FEATURES.get(name)
  if (keywords === undefined) return new Unsupported(`the media feature "${name}"`)
  return keywords.get(value) ?? new Unsupported(`the value "${value}" of ${name}`)
}

/** The test of a comparison, `width >= 600px` or `600px <= width`; undefined when neither side is a size feature. */
function readComparison([left, operator, right]: [string, Operator, string]): MaybeReading {
  if (SIZE_FEATURES.has(left)) return compareSize(left, operator, right)
  if (SIZE_FEATURES.has(right)) return compareSize(right, FLIPPED[operator], left)
  return undefined
}

/** The test of a size between two lengths, `400px <= width < 800px`; undefined unless both operators point the same way: `<` and `<=`, or `>` and `>=`. */
function readBetween([low, first, feature, second, high]: [
  string,
  Operator,
  string,
  Operator,
  string,
]): MaybeReading {
  if (first === '=' || second === '=' || first.startsWith('<') !== second.startsWith('<')) {
    return undefined
  }
  const above = compareSize(feature, FLIPPED[first], low)
  const below = compareSize(feature, second, high)
  if (above instanceof Unsupported) return above
  if (below instanceof Unsupported) return below
  return (state, remBase) => above(state, remBase) && below(state, remBase)
}

/** The test of a range: `width >= 600px`, `600px <= width`, `400px <= width < 800px`. */
function readRange(parts: string[]): Reading {
  let read: MaybeReading
  if (parts.length === 3) read = readComparison(parts as [string, Operator, string])
  else if (parts.length === 5 && SIZE_FEATURES.has(parts[2])) {
    read = readBetween(parts as [string, Operator, string, Operator, string])
  }
  if (read !== undefined) return read
  const name = parts.find((part) => NAME.test(part) && !SIZE_FEATURES.has(part))
  return new Unsupported(
    name === undefined ? `the range "${parts.join(' ')}"` : `the media feature "${name}"`
  )
}

/** The test of the text inside one pair of parentheses. */
function readFeature(text: string): Reading {
  const colon = text.indexOf(':')
  if (colon >= 0) return readPlainFeature(text.slice(0, colon).trim(), text.slice(colon + 1).trim())
  const parts = text.split(RANGE).map((part) => part.trim())
  if (parts.length > 1) return readRange(parts)
  return new Unsupported(NAME.test(text) ? `the media feature "${text}"` : `the text "(${text})"`)
}

/** Whether `token` is a feature in parentheses. */
const isFeature = (token: string | undefined): token is string =>
  token !== undefined && token.length > 1 && token.startsWith('(')

/** The tests of the features of `tokens` from `start`, joined by `and`; `invalid` when the tokens are not that, or what the binding cannot evaluate in a feature. */
function readFeatures(
  tokens: readonly string[],
  start: number,
  invalid: Unsupported
): Test[] | Unsupported {
  const tests: Test[] = []
  let index = start
  for (;;) {
    const token = tokens[index++]
    if (!isFeature(token)) return invalid
    const test = readFeature(token.slice(1, -1).trim())
    if (test instanceof Unsupported) return test
    tests.push(test)
    if (index === tokens.length) return tests
    if (tokens[index++] !== 'and') return invalid
  }
}

/** The tests of a query whose media type is at `index` of `tokens`: none for the type alone, else those of the features after its `and`. */
function readTypedFeatures(
  tokens: readonly string[],
  index: number,
  invalid: Unsupported
): Test[] | Unsupported {
  const type = tokens[index]
  if (type !== 'all' && type !== 'screen') return new Unsupported(`the media type "${type}"`)
  if (index + 1 === tokens.length) return []
  if (tokens[index + 1] !== 'and') return invalid
  return readFeatures(tokens, index + 2, invalid)
}

/** The test of one query of a list: `not` or `only`, a media type, and features joined by `and`. */
function readQuery(text: string): Reading {
  const tokens = text.match(TOKEN) ?? []
  const invalid = new Unsupported(`the text "${text}"`)
  const isNegated = tokens[0] === 'not'
  const index = isNegated || tokens[0] === 'only' ? 1 : 0
  const type = tokens[index]
  const tests =
    type !== undefined && NAME.test(type)
      ? readTypedFeatures(tokens, index, invalid)
      : readFeatures(tokens, index, invalid)
  if (tests instanceof Unsupported) return tests
  // A media type alone has no test: it matches, unless it is negated.
  return (state, remBase) => tests.every((test) => test(state, remBase)) !== isNegated
}

/** `text` read as a media query list, with or without `@media` in front. */
function parseMediaQuery(text: string): MediaQuery {
  const list = text.replace(MEDIA_PREFIX, '').trim().toLowerCase()
  const tests: Test[] = []
  for (const part of list.split(',')) {
    const test = readQuery(part.trim())
    if (test instanceof Unsupported) return { matches: matchNever, problem: test.problem }
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
