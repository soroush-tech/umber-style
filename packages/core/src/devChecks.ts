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

/**
 * The function that asks for a check of `page` (the document by default): it runs `findMissingStyles` once, after the calls
 * have stopped for a short while, and warns once for each problem (never again for the same one). The
 * rules given to it are asked about in the same run: a declaration that the browser does not support
 * (`findUnsupportedDeclarations`) is warned about once for each message. Where the browser cannot be
 * asked (no `CSS.supports`, or jsdom) the rules are not kept.
 */
export function createDevChecker(
  prefix: string,
  delay = CHECK_DELAY,
  page: Document = document
): (rules?: readonly string[]) => void {
  const warned = new Set<string>()
  const supports = findBrowserSupports()
  const written: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const warn = (key: string, message: string): void => {
    if (warned.has(key)) return
    warned.add(key)
    console.warn(`[${prefix}] ${message}`)
  }
  const run = (): void => {
    timer = undefined
    for (const problem of findMissingStyles(page, { prefix })) {
      warn(problem.key, problem.message)
    }
    if (!supports) return
    for (const message of findUnsupportedDeclarations(written.splice(0), prefix, supports)) {
      warn(`declaration:${message}`, message)
    }
  }
  return (rules) => {
    if (supports && rules) written.push(...rules)
    timer ??= setTimeout(run, delay)
  }
}
