import { codeAt } from './codeAt'
import { scanVariables } from './variables'

/** What the CSS text of an engine's style element holds: the picture of a page that a cache builds at start-up. */
export interface StyleFindings {
  /** Whether the layer order statement `@layer a,b,c;` is there. */
  hasLayerOrder: boolean
  /** The classes that rules name: components, overrides, sheet entries, the scope class. Theme classes and the markers are not among them. */
  classes: Set<string>
  /** The theme classes that have a rule, with the variables the rules declare. */
  themes: Map<string, Set<string>>
  /** The `@property` rules, by variable name, with the text of the rule. */
  properties: Map<string, string>
  /** The variables that the rules of the classes refer to. */
  variables: Set<string>
}

/** Makes findings that hold nothing. */
export function createEmptyFindings(): StyleFindings {
  return {
    hasLayerOrder: false,
    classes: new Set(),
    themes: new Map(),
    properties: new Map(),
    variables: new Set(),
  }
}

/** A block that is open: its prelude, where its body starts, and whether it holds a block of its own. */
interface OpenBlock {
  prelude: string
  bodyStart: number
  hasChild: boolean
}

const PROPERTY_AT_RULE = '@property'

/** Whether `code` is a character of a class name: a lowercase letter, a digit, '-' or '_'. */
function isNameCode(code: number): boolean {
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 95
}

/** The classes in `selector` whose name starts with `start` (`<prefix>-`), without the dot. */
function readClasses(selector: string, start: string): string[] {
  const names: string[] = []
  let from = selector.indexOf(`.${start}`)
  while (from !== -1) {
    let end = from + 1 + start.length
    while (isNameCode(codeAt(selector, end))) end++
    names.push(selector.slice(from + 1, end))
    from = selector.indexOf(`.${start}`, end)
  }
  return names
}

/** The names of the variables that `body`, the declarations of a rule, declares. */
function readDeclared(body: string): Set<string> {
  const names = new Set<string>()
  for (const part of body.split(';')) {
    const text = part.trimStart()
    if (text.startsWith('--')) names.add(text.slice(0, text.indexOf(':')))
  }
  return names
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

/** Records the innermost rule `prelude{body}` of a style element in `found`. */
function record(found: StyleFindings, prefix: string, prelude: string, body: string): void {
  if (prelude.startsWith(PROPERTY_AT_RULE)) {
    found.properties.set(prelude.slice(PROPERTY_AT_RULE.length).trim(), `${prelude}{${body}}`)
    return
  }
  if (prelude.startsWith('@')) return
  const themeStart = `${prefix}-theme-`
  const classes = readClasses(prelude, `${prefix}-`)
  const themeId = classes.length === 1 && prelude === `.${classes[0]}` ? classes[0] : undefined
  if (themeId?.startsWith(themeStart)) {
    const declared = found.themes.get(themeId) ?? new Set<string>()
    for (const name of readDeclared(body)) declared.add(name)
    found.themes.set(themeId, declared)
    return
  }
  const markers = new Set([`${prefix}-boundary`, `${prefix}-scheme-light`, `${prefix}-scheme-dark`])
  for (const name of classes) {
    if (!name.startsWith(themeStart) && !markers.has(name)) found.classes.add(name)
  }
  for (const name of scanVariables(body, `--${prefix}-`)) found.variables.add(name)
}

/** Opens a block at `index`, a `{`: its prelude is the text since `boundary`. */
function openBlock(stack: OpenBlock[], text: string, boundary: number, index: number): void {
  const parent = stack.at(-1)
  if (parent) parent.hasChild = true
  stack.push({ prelude: text.slice(boundary, index).trim(), bodyStart: index + 1, hasChild: false })
}

/** Closes the innermost block at `index`, a `}`; a block without a block of its own is a rule to record. */
function closeBlock(
  stack: OpenBlock[],
  found: StyleFindings,
  prefix: string,
  text: string,
  index: number
): void {
  const block = stack.pop()
  if (block && !block.hasChild) {
    record(found, prefix, block.prelude, text.slice(block.bodyStart, index))
  }
}

/**
 * Reads the CSS that an engine wrote (compact, no comments) in one pass and adds what it holds to
 * `found`: the layer order statement, the classes with a rule, each theme class with the variables it
 * declares, the `@property` rules and the variables that rules use.
 */
export function scanStyleText(
  prefix: string,
  text: string,
  found: StyleFindings = createEmptyFindings()
): StyleFindings {
  const stack: OpenBlock[] = []
  let boundary = 0
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '"' || char === "'") {
      index = skipString(text, index)
      continue
    }
    if (char === '{') {
      openBlock(stack, text, boundary, index)
      boundary = index + 1
    } else if (char === '}') {
      closeBlock(stack, found, prefix, text, index)
      boundary = index + 1
    } else if (char === ';' && stack.length === 0) {
      if (text.slice(boundary, index).trim().startsWith('@layer')) found.hasLayerOrder = true
      boundary = index + 1
    }
    index++
  }
  return found
}
