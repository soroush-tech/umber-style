/** What a browser answers through `CSS.supports`: whether it takes `value` for `property`. */
export type Supports = (property: string, value: string) => boolean

/** A rule that holds declarations: its selector, the prelude of the block around it ('' at the top) and its body. */
interface StyleRuleText {
  selector: string
  parent: string
  body: string
}

/** A block that is open: its prelude, where its body starts, and whether it holds a block of its own. */
interface OpenBlock {
  prelude: string
  bodyStart: number
  hasChild: boolean
}

const KEYFRAMES_AT_RULE = '@keyframes'
const IMPORTANT = 'important'
/** A value that starts with a vendor prefix: a keyword or a function written for another browser. */
const VENDOR_VALUE = /^-(?:webkit|moz|ms|o)-/i

/**
 * `CSS.supports` of the browser, or undefined where there is none to trust: no `CSS` (a server), one
 * that throws or answers two plain questions wrong, or jsdom, which answers from a table of its own and
 * not from what a browser renders. The checker of a cache asks once, when it is made.
 */
export function findBrowserSupports(): Supports | undefined {
  try {
    const isUsable =
      !navigator.userAgent.includes('jsdom') &&
      CSS.supports('color', 'red') &&
      !CSS.supports('color', 'not-a-color')
    return isUsable ? (property, value) => CSS.supports(property, value) : undefined
  } catch {
    return undefined
  }
}

/** The index after the string that starts at `index`, which is a quote. */
function skipString(text: string, index: number): number {
  const quote = text[index]
  let position = index + 1
  while (position < text.length && text[position] !== quote) {
    position += text[position] === '\\' ? 2 : 1
  }
  return position + 1
}

/** Opens a block at `index`, a `{`: its prelude is the text since `boundary`. */
function openBlock(stack: OpenBlock[], text: string, boundary: number, index: number): void {
  const parent = stack.at(-1)
  if (parent) parent.hasChild = true
  stack.push({ prelude: text.slice(boundary, index).trim(), bodyStart: index + 1, hasChild: false })
}

/** Closes the innermost block at `index`, a `}`: a block without a block of its own that is not an at-rule is a rule to add to `rules`. */
function closeBlock(stack: OpenBlock[], text: string, index: number, rules: StyleRuleText[]): void {
  const block = stack.pop()
  if (!block || block.hasChild || block.prelude.startsWith('@')) return
  const parent = stack.at(-1)?.prelude ?? ''
  rules.push({ selector: block.prelude, parent, body: text.slice(block.bodyStart, index) })
}

/** The innermost blocks of `text` that are not at-rules: the rules that hold declarations. */
function readStyleRules(text: string): StyleRuleText[] {
  const rules: StyleRuleText[] = []
  const stack: OpenBlock[] = []
  let boundary = 0
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '"' || char === "'") {
      index = skipString(text, index)
      continue
    }
    if (char === ';') boundary = index + 1
    else if (char === '{') {
      openBlock(stack, text, boundary, index)
      boundary = index + 1
    } else if (char === '}') {
      closeBlock(stack, text, index, rules)
      boundary = index + 1
    }
    index++
  }
  return rules
}

/** Adds the declaration `declaration` (`property:value`) to `declarations`, unless it has no ':'. */
function addDeclaration(declarations: Map<string, string>, declaration: string): void {
  const colon = declaration.indexOf(':')
  if (colon === -1) return
  declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
}

/** The declarations of `body` by property, the last one of each: the items before it in a fallback list are meant to be dropped. */
function readLastDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>()
  let depth = 0
  let start = 0
  let index = 0
  while (index <= body.length) {
    const char = body[index]
    if (char === '"' || char === "'") {
      index = skipString(body, index)
      continue
    }
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (index === body.length || (char === ';' && depth === 0)) {
      addDeclaration(declarations, body.slice(start, index))
      start = index + 1
    }
    index++
  }
  return declarations
}

/**
 * `value` without a `!important` at its end (in any case, with whitespace around the `!`), and without
 * the whitespace before it. A scan from the end: nothing is tried twice, so it takes linear time.
 */
function stripImportant(value: string): string {
  const trimmed = value.trimEnd()
  if (trimmed.slice(-IMPORTANT.length).toLowerCase() !== IMPORTANT) return value
  const before = trimmed.slice(0, -IMPORTANT.length).trimEnd()
  return before.endsWith('!') ? before.slice(0, -1).trimEnd() : value
}

/** What a message names a rule by: its `@keyframes` rule, the last class of the engine in its selector, or its selector for a global rule. */
function describeRule({ selector, parent }: StyleRuleText, classPattern: RegExp): string {
  if (parent.startsWith(KEYFRAMES_AT_RULE)) {
    return `the keyframes ${parent.slice(KEYFRAMES_AT_RULE.length).trim()}`
  }
  const name = [...selector.matchAll(classPattern)].at(-1)?.[1]
  return name === undefined ? `the global rule ${selector}` : `the class ${name}`
}

/**
 * Asks the browser about each declaration of `texts`, rules that an engine wrote, and returns a message
 * for each one that it does not support. Only the last declaration of a property in a rule is asked
 * about. A property that starts with a hyphen is left out: a custom property takes any value, and one
 * with a vendor prefix is written for another browser, as is a value that starts with a vendor prefix
 * (`-moz-available`, `-webkit-linear-gradient(...)`). For a value with `var(`, which is valid until it
 * is used, the browser is asked whether it knows the property at all. `!important` is not part of the
 * question. At-rules with descriptors (`@property`, `@font-face`) are not asked about.
 */
export function findUnsupportedDeclarations(
  texts: readonly string[],
  prefix: string,
  supports: Supports
): string[] {
  const classPattern = new RegExp(String.raw`\.(${prefix}-[a-z0-9_-]*)`, 'g')
  const messages: string[] = []
  for (const text of texts) {
    for (const rule of readStyleRules(text)) addRuleMessages(rule, classPattern, supports, messages)
  }
  return messages
}

/** Adds to `messages` a message for each last declaration of `rule` that the browser does not support (see `findUnsupportedDeclarations`). */
function addRuleMessages(
  rule: StyleRuleText,
  classPattern: RegExp,
  supports: Supports,
  messages: string[]
): void {
  for (const [name, value] of readLastDeclarations(rule.body)) {
    const plain = stripImportant(value)
    if (name.startsWith('-') || VENDOR_VALUE.test(plain)) continue
    const asked = plain.includes('var(') ? 'inherit' : plain
    if (supports(name, asked)) continue
    const owner = describeRule(rule, classPattern)
    messages.push(`${owner} declares ${name}:${value}, which this browser does not support`)
  }
}
