// This file imports nothing at run time: the end-to-end tests send its compiled text into a page, so
// the checker that they run is the one that the development mode runs.

/** What `findMissingStyles` can find. */
export type StyleProblemKind =
  | 'class-without-rule'
  | 'variable-without-value'
  | 'root-without-theme'

/** One thing the page lacks. */
export interface StyleProblem {
  /** What is missing: a rule for a class, a value for a variable, or a theme for a rule of the root. */
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

/** What `findMissingStyles` is told about the page it checks. */
export interface FindMissingStylesOptions {
  /** The prefix of the engine. Default: the one the style elements of the page say. */
  prefix?: string
}

const STATE_PATTERN = /:(hover|focus|active|focus-visible|focus-within)\b/
const NAME_CODES = /[a-z0-9_-]/
/** A selector that names the root element or the body: `html`, `body` or `:root` as a whole word. */
const ROOT_PATTERN = /(?:^|[\s>+~(,])(?:html|body)(?![\w-])|:root(?![\w-])/
/** The prefix named by the first style element of an engine in `page`, or undefined. */
function findPrefix(page: Document): string | undefined {
  const element = page.querySelector<HTMLElement>('style[data-style], style[data-precedence]')
  return element?.dataset.style ?? element?.dataset.precedence
}

/** Whether `rule` is a style rule. A rule of another document (an iframe's) is not an instance of this window's `CSSStyleRule`, so the name of its class is read instead. */
function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return rule.constructor.name === 'CSSStyleRule'
}

/** The style rules under `list`, groups included. */
function collectStyleRules(list: CSSRuleList, found: CSSStyleRule[]): CSSStyleRule[] {
  for (const rule of list) {
    if (isStyleRule(rule)) found.push(rule)
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

/** The rules of the engine's style elements in `page` (those of `data-umber` too), each with the variables it uses without a fallback. */
function collectRules(page: Document, prefix: string) {
  const selector = `style[data-style="${prefix}"], style[data-precedence="${prefix}"], style[data-umber~="${prefix}"], style[data-umber~="${prefix}-global"]`
  const rules: CSSStyleRule[] = []
  for (const element of page.querySelectorAll<HTMLStyleElement>(selector)) {
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
    const { selectorText } = rule
    for (const name of variables) {
      if (computed.getPropertyValue(name).trim() !== '') continue
      const message = `${label} has no value for ${name}, which ${selectorText} uses`
      const key = `variable:${name}:${selectorText}`
      problems.push({ kind: 'variable-without-value', name, element: label, message, key })
    }
  }
}

/**
 * The global rules (rules that name no class of the engine) for `html`, `body` or `:root` that match
 * `element`, `<html>` or `<body>` without a class of the engine, and use variables that have no value
 * on it: one problem for each rule, with all of those variables. A variable is declared on the element
 * that carries a theme class and below it, so a rule for `html` or `body` sees the variables of a theme
 * only when they are declared on `:root` (what the outermost provider does) or the theme class is on
 * `<html>`; then there is no problem.
 */
function findRootProblems(
  element: Element,
  label: string,
  rules: readonly EngineRule[],
  start: string,
  problems: StyleProblem[]
): void {
  const computed = getComputedStyle(element)
  for (const { rule, variables, isState } of rules) {
    const selector = rule.selectorText
    const isGlobal = readClassNames(selector, start).length === 0 && ROOT_PATTERN.test(selector)
    if (variables.length === 0 || isState || !isGlobal || !isMatched(element, rule)) continue
    const missing = variables.filter((name) => computed.getPropertyValue(name).trim() === '')
    if (missing.length === 0) continue
    const message = `${label} has no value for ${missing.join(', ')}, which the global rule ${selector} uses: a rule for html or body sees the variables of a theme declared on :root (the outermost provider) or on <html> (its theme class)`
    problems.push({
      kind: 'root-without-theme',
      name: missing[0],
      element: label,
      message,
      key: `root:${selector}`,
    })
  }
}

/**
 * Looks at a page that an engine styled, and lists what is missing. For each element under `root`
 * (the document by default; the style elements are read in the document of `root`): every class of the engine on it is named by at least one rule of the
 * engine's style elements (its own, and the ones React hoists), and every variable of the engine that
 * a rule matching the element uses, without a fallback, has a value on the element. The classes that
 * are markers (`<prefix>-boundary`, `<prefix>-scheme-light` and `-dark`) have no rule of their own and
 * are left out, and so is `<prefix>-theme-0`, the theme class of a theme that declares nothing, which has
 * no rule by design; and so are the rules for `:hover`, `:focus` and the like. `<html>` and `<body>` without
 * a class of the engine are checked for the global rules that name them (see `root-without-theme`). An
 * empty list means nothing is missing. Where there is no document, or no style element of an engine,
 * the list is empty.
 */
export function findMissingStyles(
  root?: ParentNode,
  options: FindMissingStylesOptions = {}
): StyleProblem[] {
  if (typeof document === 'undefined') return []
  const scope = root ?? document
  // A document has no owner document: it is its own.
  const page = (scope as Node).ownerDocument ?? (scope as Document)
  const prefix = options.prefix ?? findPrefix(page)
  if (prefix === undefined) return []
  const rules = collectRules(page, prefix)
  const named = new Set(
    rules.flatMap(({ rule }) => readClassNames(rule.selectorText, `${prefix}-`))
  )
  const markers = new Set([
    `${prefix}-boundary`,
    `${prefix}-scheme-light`,
    `${prefix}-scheme-dark`,
    `${prefix}-theme-0`,
  ])
  const problems: StyleProblem[] = []
  const elements = [
    ...((scope as Node).nodeType === 1 ? [scope as Element] : []),
    ...scope.querySelectorAll('*'),
  ]
  for (const element of elements) {
    const classes = [...element.classList].filter(
      (name) => name.startsWith(`${prefix}-`) && !markers.has(name)
    )
    if (classes.length === 0) {
      if (element === page.documentElement || element === page.body) {
        findRootProblems(element, describe(element), rules, `${prefix}-`, problems)
      }
      continue
    }
    const label = describe(element)
    findClassProblems(label, classes, named, problems)
    findVariableProblems(element, label, rules, problems)
  }
  return problems
}
