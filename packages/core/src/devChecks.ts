import { findMissingStyles } from './findMissingStyles'
import { findBrowserSupports, findUnsupportedDeclarations } from './findUnsupportedDeclarations'

/** `process` where there is one: the type is declared here so that the core needs no type package for it. */
declare const process: { env: { NODE_ENV?: string } }

/** How long a check waits after the last insertion, in milliseconds: rules arrive in bursts while a page renders. */
const CHECK_DELAY = 250

/** Whether this is a development build: `process.env.NODE_ENV` is `development`. Where `process` does not exist (a browser, no bundler) it is not. */
export function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV === 'development'
  } catch {
    return false
  }
}

/** Whether this is a production build: `process.env.NODE_ENV` is `production`. Where `process` does not exist (a browser, no bundler) it is taken as one. */
export function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return true
  }
}

// The options objects warned about for `hasRuleText`: an object that is passed on is warned about once.
const renamedWarned = new WeakSet<object>()

/**
 * In development, warns once about `options` when it still has `hasRuleText`, which was renamed to
 * `speedy` with the opposite meaning: what to write instead, and that the value given is not read.
 */
export function warnRenamedOption(prefix: string, options: object): void {
  const { hasRuleText } = options as { hasRuleText?: unknown }
  if (hasRuleText === undefined || renamedWarned.has(options)) return
  // What `isDevelopment()` reads is written out in front of it, so that a bundler that writes in
  // production for `process.env.NODE_ENV` drops the branch and its text (see `devChecks.md`).
  if (
    typeof process === 'object' &&
    process.env != null &&
    process.env.NODE_ENV !== 'production' &&
    isDevelopment()
  ) {
    renamedWarned.add(options)
    // The option was a boolean: what was given is read as one, and so is what to write instead.
    const given = hasRuleText ? 'true' : 'false'
    const instead = hasRuleText ? 'speedy: false' : 'speedy: true'
    console.warn(
      `[${prefix}] The option hasRuleText was renamed to speedy, with the opposite meaning: hasRuleText: ${given} is not read, and the default applies. Write ${instead} instead.`
    )
  }
}

/** A function that warns `message` with the prefix in front, once for each `key`: the same problem is never warned about twice. */
export function createWarner(prefix: string): (key: string, message: string) => void {
  const warned = new Set<string>()
  return (key, message) => {
    if (warned.has(key)) return
    warned.add(key)
    console.warn(`[${prefix}] ${message}`)
  }
}

/**
 * The function that asks for a check of `page` (the document by default): it runs `findMissingStyles` once, after the calls
 * have stopped for a short while, and warns once for each problem (never again for the same one). The
 * rules given to it are asked about in the same run: a declaration that the browser does not support
 * (`findUnsupportedDeclarations`) is warned about once for each message. Where the browser cannot be
 * asked (no `CSS.supports`, or jsdom) the rules are not kept. `readLabel` gives the label of a class, which
 * a message names.
 */
export function createDevChecker(
  prefix: string,
  delay = CHECK_DELAY,
  page: Document = document,
  readLabel: (className: string) => string = () => ''
): (rules?: readonly string[]) => void {
  const supports = findBrowserSupports()
  const written: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const warn = createWarner(prefix)
  const run = (): void => {
    timer = undefined
    for (const problem of findMissingStyles(page, { prefix })) {
      warn(problem.key, problem.message)
    }
    if (!supports) return
    for (const message of findUnsupportedDeclarations(
      written.splice(0),
      prefix,
      supports,
      readLabel
    )) {
      warn(`declaration:${message}`, message)
    }
  }
  return (rules) => {
    if (supports && rules) written.push(...rules)
    timer ??= setTimeout(run, delay)
  }
}
