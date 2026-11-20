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
const IMPORTANT = /\s*!\s*important\s*$/i
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

/** The innermost blocks of `text` that are not at-rules: the rules that hold declarations. */
function readStyleRules(text: string): StyleRuleText[] {
  const rules: StyleRuleText[] = []
  const stack: OpenBlock[] = []
  let boundary = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' || char === "'") index = skipString(text, index) - 1
    else if (char === ';') boundary = index + 1
    else if (char === '{') {
      const parent = stack.at(-1)
      if (parent) parent.hasChild = true
      stack.push({
        prelude: text.slice(boundary, index).trim(),
        bodyStart: index + 1,
        hasChild: false,
      })
      boundary = index + 1
    } else if (char === '}') {
      const block = stack.pop()
      if (block && !block.hasChild && !block.prelude.startsWith('@')) {
        const parent = stack.at(-1)?.prelude ?? ''
        rules.push({ selector: block.prelude, parent, body: text.slice(block.bodyStart, index) })
      }
      boundary = index + 1
    }
  }
  return rules
}

/** The declarations of `body` by property, the last one of each: the items before it in a fallback list are meant to be dropped. */
function readLastDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>()
  let depth = 0
  let start = 0
  for (let index = 0; index <= body.length; index++) {
    const char = body[index]
    if (char === '"' || char === "'") index = skipString(body, index) - 1
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (index === body.length || (char === ';' && depth === 0)) {
      const declaration = body.slice(start, index)
      const colon = declaration.indexOf(':')
      if (colon !== -1) {
        declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
      }
      start = index + 1
    }
  }
  return declarations
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
  const classPattern = new RegExp(`\\.(${prefix}-[a-z0-9_-]*)`, 'g')
  const messages: string[] = []
  for (const text of texts) {
    for (const rule of readStyleRules(text)) {
      for (const [name, value] of readLastDeclarations(rule.body)) {
        const plain = value.replace(IMPORTANT, '')
        if (name.startsWith('-') || VENDOR_VALUE.test(plain)) continue
        const asked = plain.includes('var(') ? 'inherit' : plain
        if (supports(name, asked)) continue
        const owner = describeRule(rule, classPattern)
        messages.push(`${owner} declares ${name}:${value}, which this browser does not support`)
      }
    }
  }
  return messages
}
