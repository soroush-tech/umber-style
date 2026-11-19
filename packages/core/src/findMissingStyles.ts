// This file imports nothing at run time: the end-to-end tests send its compiled text into a page, so
// the checker that they run is the one that the development mode runs.

/** What `findMissingStyles` can find. */
export type StyleProblemKind = 'class-without-rule' | 'variable-without-value'

/** One thing the page lacks. */
export interface StyleProblem {
  kind: StyleProblemKind
  /** The class, or the variable. */
  name: string
  /** A short description of the element: `tag[test id or id]`. */
  element: string
  /** What is wrong, in a sentence. */
  message: string
  /** What makes two problems the same one: the kind and the name, and for a variable the rule that uses it. */
  key: string
}

export interface FindMissingStylesOptions {
  /** The prefix of the engine. Default: the one the style elements of the page say. */
  prefix?: string
}

const STATE_PATTERN = /:(hover|focus|active|focus-visible|focus-within)\b/
const NAME_CODES = /[a-z0-9_-]/

/** The prefix named by the first style element of an engine on the page, or undefined. */
function findPrefix(): string | undefined {
  const element = document.querySelector<HTMLElement>('style[data-style], style[data-precedence]')
  return element?.dataset.style ?? element?.dataset.precedence
}

/** The style rules under `list`, groups included. */
function collectStyleRules(list: CSSRuleList, found: CSSStyleRule[]): CSSStyleRule[] {
  for (const rule of list) {
    if (rule instanceof CSSStyleRule) found.push(rule)
    else if ('cssRules' in rule) collectStyleRules((rule as CSSGroupingRule).cssRules, found)
  }
  return found
}

/** The classes that start with `start` in `selector`. */
function readClassNames(selector: string, start: string): string[] {
  const names: string[] = []
  let from = selector.indexOf(`.${start}`)
  while (from !== -1) {
    let end = from + 1 + start.length
    while (end < selector.length && NAME_CODES.test(selector[end])) end++
    names.push(selector.slice(from + 1, end))
    from = selector.indexOf(`.${start}`, end)
  }
  return names
}

/** The variables that `text` refers to without a fallback: `var(--prefix-x)`. */
function readBareVariables(text: string, start: string): string[] {
  const names: string[] = []
  let from = text.indexOf('var(')
  while (from !== -1) {
    const begin = from + 4
    let end = begin + start.length
    if (text.startsWith(start, begin)) {
      while (end < text.length && NAME_CODES.test(text[end])) end++
      if (text[end] === ')') names.push(text.slice(begin, end))
    }
    from = text.indexOf('var(', begin)
  }
  return names
}

/** A short name of `element` for a message. */
function describe(element: Element): string {
  const label = element.attributes.getNamedItem('data-testid')?.value ?? element.id
  return `${element.tagName.toLowerCase()}[${label}]`
}

/** Whether `element` matches the selector of `rule`; a selector the browser cannot parse matches nothing. */
function isMatched(element: Element, rule: CSSStyleRule): boolean {
  try {
    return element.matches(rule.selectorText)
  } catch {
    return false
  }
}

/** The rules of the engine's style elements, each with the variables it uses without a fallback. */
function collectRules(prefix: string) {
  const selector = `style[data-style="${prefix}"], style[data-precedence="${prefix}"]`
  const rules: CSSStyleRule[] = []
  for (const element of document.querySelectorAll<HTMLStyleElement>(selector)) {
    if (element.sheet) collectStyleRules(element.sheet.cssRules, rules)
  }
  return rules.map((rule) => ({
    rule,
    variables: readBareVariables(rule.cssText, `--${prefix}-`),
    isState: STATE_PATTERN.test(rule.selectorText),
  }))
}

type EngineRule = ReturnType<typeof collectRules>[number]

/** The classes of the engine on the element called `label` that no rule names. */
function findClassProblems(
  label: string,
  classes: readonly string[],
  named: ReadonlySet<string>,
  problems: StyleProblem[]
): void {
  for (const name of classes) {
    if (named.has(name)) continue
    const message = `${label} has the class ${name}, which no rule names`
    problems.push({
      kind: 'class-without-rule',
      name,
      element: label,
      message,
      key: `class:${name}`,
    })
  }
}

/** The variables used by a rule that matches `element` and that have no value on it. */
function findVariableProblems(
  element: Element,
  label: string,
  rules: readonly EngineRule[],
  problems: StyleProblem[]
): void {
  const computed = getComputedStyle(element)
  for (const { rule, variables, isState } of rules) {
    if (variables.length === 0 || isState || !isMatched(element, rule)) continue
    for (const name of variables) {
      if (computed.getPropertyValue(name).trim() !== '') continue
      const message = `${label} has no value for ${name}, which ${rule.selectorText} uses`
      const key = `variable:${name}:${rule.selectorText}`
      problems.push({ kind: 'variable-without-value', name, element: label, message, key })
    }
  }
}

/**
 * Looks at a page that an engine styled, and lists what is missing. For each element under `root`
 * (the document by default): every class of the engine on it is named by at least one rule of the
 * engine's style elements (its own, and the ones React hoists), and every variable of the engine that
 * a rule matching the element uses, without a fallback, has a value on the element. The classes that
 * are markers (`<prefix>-boundary`, `<prefix>-scheme-light` and `-dark`) have no rule of their own and
 * are left out, and so are the rules for `:hover`, `:focus` and the like. An empty list means nothing
 * is missing. Where there is no document, or no style element of an engine, the list is empty.
 */
export function findMissingStyles(
  root?: ParentNode,
  options: FindMissingStylesOptions = {}
): StyleProblem[] {
  if (typeof document === 'undefined') return []
  const prefix = options.prefix ?? findPrefix()
  if (prefix === undefined) return []
  const scope = root ?? document
  const rules = collectRules(prefix)
  const named = new Set(
    rules.flatMap(({ rule }) => readClassNames(rule.selectorText, `${prefix}-`))
  )
  const markers = new Set([`${prefix}-boundary`, `${prefix}-scheme-light`, `${prefix}-scheme-dark`])
  const problems: StyleProblem[] = []
  const elements = [...(scope instanceof Element ? [scope] : []), ...scope.querySelectorAll('*')]
  for (const element of elements) {
    const classes = [...element.classList].filter(
      (name) => name.startsWith(`${prefix}-`) && !markers.has(name)
    )
    if (classes.length === 0) continue
    const label = describe(element)
    findClassProblems(label, classes, named, problems)
    findVariableProblems(element, label, rules, problems)
  }
  return problems
}
