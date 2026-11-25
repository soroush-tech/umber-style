import { readName } from './cssName'
import { ROOT_SELECTOR } from './theme'
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
  /** The names of the `@keyframes` rules. */
  keyframes: Set<string>
  /** The variables that the rules of the classes refer to. */
  variables: Set<string>
  /** How many rules the text holds at its top level (blocks and statements): as many as its style sheet holds when the browser kept them all. */
  ruleCount: number
  /**
   * The top-level rules that may be global rules, each with its place among the top-level rules: those in
   * the `<prefix>-global` layer, and those in no layer that are not a layer statement, a `@property` or
   * `@keyframes` rule, or the rule of a class (`.<prefix>-...`).
   */
  globals: [index: number, text: string][]
  /** The places, among the top-level rules, of the rules of a root theme: `:where(:root){...}`, in the `<prefix>-theme` layer or in none. */
  roots: number[]
}

/** Makes findings that hold nothing. */
export function createEmptyFindings(): StyleFindings {
  return {
    hasLayerOrder: false,
    classes: new Set(),
    themes: new Map(),
    properties: new Map(),
    keyframes: new Set(),
    variables: new Set(),
    ruleCount: 0,
    globals: [],
    roots: [],
  }
}

/** A block that is open: its prelude, where its body starts, and whether it holds a block of its own. */
interface OpenBlock {
  prelude: string
  bodyStart: number
  hasChild: boolean
}

const LAYER_AT_RULE = '@layer'
const PROPERTY_AT_RULE = '@property'
const KEYFRAMES_AT_RULE = '@keyframes'

/** The classes in `selector` whose name starts with `start` (`<prefix>-`), without the dot, as `readName` reads them: the name the cache keys a class by. */
function readClasses(selector: string, start: string): string[] {
  const names: string[] = []
  let from = selector.indexOf(`.${start}`)
  while (from !== -1) {
    const [name, end] = readName(selector, from + 1)
    names.push(name)
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
  // A root theme declares variables; it uses none.
  if (prelude.startsWith('@') || prelude === ROOT_SELECTOR) return
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

/** Closes the innermost block at `index`, a `}`, and returns it: a `@keyframes` rule records its name, and a block without a block of its own is a rule to record. */
function closeBlock(
  stack: OpenBlock[],
  found: StyleFindings,
  prefix: string,
  text: string,
  index: number
): OpenBlock | undefined {
  const block = stack.pop()
  if (block?.prelude.startsWith(KEYFRAMES_AT_RULE)) {
    found.keyframes.add(block.prelude.slice(KEYFRAMES_AT_RULE.length).trim())
  } else if (block && !block.hasChild) {
    record(found, prefix, block.prelude, text.slice(block.bodyStart, index))
  }
  return block
}

/** Whether a top-level rule with `prelude` may be a global rule: in the global layer, or in none and not a rule that the engine writes for something else. */
function isGlobalPrelude(prefix: string, prelude: string): boolean {
  if (prelude.startsWith(LAYER_AT_RULE)) return prelude === `${LAYER_AT_RULE} ${prefix}-global`
  return (
    !prelude.startsWith(PROPERTY_AT_RULE) &&
    !prelude.startsWith(KEYFRAMES_AT_RULE) &&
    !prelude.startsWith(`.${prefix}-`)
  )
}

/** Whether the top-level rule `text` is the rule of a root theme, in the theme layer or in none. */
function isRootRule(prefix: string, text: string): boolean {
  return (
    text.startsWith(`${ROOT_SELECTOR}{`) ||
    text.startsWith(`${LAYER_AT_RULE} ${prefix}-theme{${ROOT_SELECTOR}{`)
  )
}

/** Closes the innermost block at `index`, a `}`; when it is a top-level rule (which started at `ruleStart`), records its place in `found`, and whether it is the rule of a root theme or may be a global rule. */
function closeRule(
  stack: OpenBlock[],
  found: StyleFindings,
  prefix: string,
  text: string,
  ruleStart: number,
  index: number
): void {
  const block = closeBlock(stack, found, prefix, text, index)
  if (!block || stack.length > 0) return
  const place = found.ruleCount++
  const rule = text.slice(ruleStart, index + 1).trimStart()
  if (isRootRule(prefix, rule)) found.roots.push(place)
  else if (isGlobalPrelude(prefix, block.prelude)) found.globals.push([place, rule])
}

/** Records the top-level statement `statement` (the text before a `;`, trimmed) in `found`: a rule unless it is empty, and the layer order statement when it is one. */
function recordStatement(found: StyleFindings, statement: string): void {
  if (statement.startsWith(LAYER_AT_RULE)) found.hasLayerOrder = true
  if (statement !== '') found.ruleCount++
}

/**
 * Reads the CSS that an engine wrote (compact, no comments) in one pass and adds what it holds to
 * `found`: the layer order statement, the classes with a rule, each theme class with the variables it
 * declares, the `@property` rules, the names of the `@keyframes` rules, the variables that rules use, how
 * many rules are at the top level, the top-level rules that may be global rules, and the places of the
 * rules of a root theme.
 */
export function scanStyleText(
  prefix: string,
  text: string,
  found: StyleFindings = createEmptyFindings()
): StyleFindings {
  const stack: OpenBlock[] = []
  let boundary = 0
  let ruleStart = 0
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '"' || char === "'") {
      index = skipString(text, index)
      continue
    }
    if (char === '{') {
      if (stack.length === 0) ruleStart = boundary
      openBlock(stack, text, boundary, index)
      boundary = index + 1
    } else if (char === '}') {
      closeRule(stack, found, prefix, text, ruleStart, index)
      boundary = index + 1
    } else if (char === ';' && stack.length === 0) {
      recordStatement(found, text.slice(boundary, index).trim())
      boundary = index + 1
    }
    index++
  }
  return found
}
