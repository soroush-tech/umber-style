import { findMissingStyles } from './findMissingStyles'

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
 * The function that asks for a check of the page: it runs `findMissingStyles` once, after the calls
 * have stopped for a short while, and warns once for each problem (never again for the same one).
 */
export function createDevChecker(prefix: string, delay = CHECK_DELAY): () => void {
  const warned = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = (): void => {
    timer = undefined
    for (const problem of findMissingStyles(document, { prefix })) {
      if (warned.has(problem.key)) continue
      warned.add(problem.key)
      console.warn(`[${prefix}] ${problem.message}`)
    }
  }
  return () => {
    timer ??= setTimeout(run, delay)
  }
}
