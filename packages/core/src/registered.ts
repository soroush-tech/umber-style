/** The syntax of a registered custom property, which gives its variable a type so that it can be animated. */
export type RegisteredSyntax =
  | '<color>'
  | '<length>'
  | '<number>'
  | '<percentage>'
  | '<length-percentage>'
  | '<angle>'
  | '<time>'
  | '*'

/** The syntaxes that give a variable a type: all but the universal one. */
type TypedSyntax = Exclude<RegisteredSyntax, '*'>

const SYNTAXES: readonly string[] = [
  '<color>',
  '<length>',
  '<number>',
  '<percentage>',
  '<length-percentage>',
  '<angle>',
  '<time>',
  '*',
]

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`
/** The units that depend on the element or the viewport: a value in them cannot be an initial value. */
const RELATIVE_UNIT =
  'r?em|r?ex|r?cap|r?ch|r?ic|r?lh|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max)'
const LENGTH_UNIT = `px|cm|mm|q|in|pt|pc|${RELATIVE_UNIT}`

const NUMBER_PATTERN = new RegExp(`^${NUMBER}$`, 'i')
const LENGTH_PATTERN = new RegExp(`^${NUMBER}(?:${LENGTH_UNIT})$`, 'i')
const PERCENTAGE_PATTERN = new RegExp(`^${NUMBER}%$`, 'i')
const ANGLE_PATTERN = new RegExp(`^${NUMBER}(?:deg|grad|rad|turn)$`, 'i')
const TIME_PATTERN = new RegExp(`^${NUMBER}(?:ms|s)$`, 'i')
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_FUNCTION_PATTERN = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color(?:-mix)?)\(.*\)$/i
const TRANSPARENT_PATTERN = /^transparent$/i
const KEYWORD_PATTERN = /^[a-z]+$/i
const MATH_PATTERN = /^(?:calc|min|max|clamp)\(.*\)$/i
const RELATIVE_PATTERN = new RegExp(String.raw`[\d.](?:${RELATIVE_UNIT})(?![a-z])`, 'i')
const DEPENDENT_PATTERN = /\b(?:var|env|attr)\(|currentcolor/i

/** Whether `value` is a color literal: a hex color, a color function or `transparent`. */
const isColor = (value: string): boolean =>
  HEX_COLOR_PATTERN.test(value) ||
  COLOR_FUNCTION_PATTERN.test(value) ||
  TRANSPARENT_PATTERN.test(value)

/** Whether `value` is a length: 0, or a number with a length unit. */
const isLength = (value: string): boolean => value === '0' || LENGTH_PATTERN.test(value)

/** Whether `value` is a length or a percentage. */
const isLengthPercentage = (value: string): boolean =>
  isLength(value) || PERCENTAGE_PATTERN.test(value)

/** The test of each syntax but `*`; a keyword counts as a color. */
const MATCHERS: Record<TypedSyntax, (value: string) => boolean> = {
  '<color>': (value) => isColor(value) || KEYWORD_PATTERN.test(value),
  '<length>': isLength,
  '<number>': (value) => NUMBER_PATTERN.test(value),
  '<percentage>': (value) => PERCENTAGE_PATTERN.test(value),
  '<length-percentage>': isLengthPercentage,
  '<angle>': (value) => ANGLE_PATTERN.test(value),
  '<time>': (value) => TIME_PATTERN.test(value),
}

/** Whether `value` is a literal of the syntax; a math function (calc, min, max, clamp) is taken on trust for a number, a length, a percentage, an angle or a time. */
function isOfSyntax(syntax: TypedSyntax, value: string): boolean {
  return (syntax !== '<color>' && MATH_PATTERN.test(value)) || MATCHERS[syntax](value)
}

/** The syntax that a base theme value says: a length, a percentage, a time, an angle, a color or a number; undefined for anything else. */
function inferFromText(value: string): RegisteredSyntax | undefined {
  if (LENGTH_PATTERN.test(value)) return '<length>'
  if (PERCENTAGE_PATTERN.test(value)) return '<percentage>'
  if (TIME_PATTERN.test(value)) return '<time>'
  if (ANGLE_PATTERN.test(value)) return '<angle>'
  if (isColor(value)) return '<color>'
  return NUMBER_PATTERN.test(value) ? '<number>' : undefined
}

/** What a registered token needs to be written as a `@property` rule. */
export interface RegisteredToken {
  /** The variable name, `--css-palette-primary`. */
  name: string
  /** The dotted theme path, for the messages. */
  path: string
  /** The value in the base theme: a number under a length key is a length. */
  source: string | number
  /** The value as a theme class declares it (a length in px). */
  value: string
  /** Whether the number `source` is a length: its key is one of the length keys. */
  isLength: boolean
}

/** The syntax that the base value of a token says: a number is a length under a length key; undefined for text that says none. */
function inferFromSource(source: string | number, isLength: boolean): RegisteredSyntax | undefined {
  if (typeof source === 'string') return inferFromText(source.trim())
  return isLength ? '<length>' : '<number>'
}

/** The syntax for a token registered with `true`: the one that its base value says, or a `TypeError` that asks for one. */
function inferSyntax({ path, source, isLength }: RegisteredToken): RegisteredSyntax {
  const inferred = inferFromSource(source, isLength)
  if (inferred === undefined) {
    throw new TypeError(
      `registered: the syntax of "${path}" cannot be inferred from ${JSON.stringify(source)}: give an explicit syntax ('<color>', '<length>', '<number>', '<percentage>', '<length-percentage>', '<angle>', '<time>') or '*'.`
    )
  }
  return inferred
}

/** Throws a `TypeError` unless `declared` can be the initial value of a property of `syntax`. */
function assertInitialValue(token: RegisteredToken, syntax: TypedSyntax): void {
  const { path, value: declared } = token
  if (DEPENDENT_PATTERN.test(declared) || RELATIVE_PATTERN.test(declared)) {
    throw new TypeError(
      `registered: "${path}" is ${JSON.stringify(declared)}, which cannot be the initial value of a registered property: it depends on the element (var(), em, rem, vw, currentcolor and the like). Give it a value that does not, or register it as '*'.`
    )
  }
  if (!isOfSyntax(syntax, declared)) {
    throw new TypeError(
      `registered: "${path}" is ${JSON.stringify(declared)}, which is not a ${syntax} value. Register it with the syntax it has, or as '*'.`
    )
  }
}

/**
 * The `@property` rule of a registered token. The initial value is its base value; `inherits` is true,
 * which a variable set on a theme wrapper needs to reach what is inside. The universal syntax `*` needs
 * no initial value and gets none. Throws a `TypeError` for a syntax that is unknown, or cannot be
 * inferred, or a value that cannot be the initial value.
 */
export function createPropertyRule(
  token: RegisteredToken,
  syntax: RegisteredSyntax | true
): string {
  if (syntax !== true && !SYNTAXES.includes(syntax)) {
    throw new TypeError(
      `registered: "${token.path}" has the unknown syntax ${JSON.stringify(syntax)}: use one of ${SYNTAXES.join(', ')}.`
    )
  }
  const resolved = syntax === true ? inferSyntax(token) : syntax
  if (resolved === '*') return `@property ${token.name}{syntax:"*";inherits:true;}`
  assertInitialValue(token, resolved)
  return `@property ${token.name}{syntax:"${resolved}";inherits:true;initial-value:${token.value};}`
}
