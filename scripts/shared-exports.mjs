// The pure part of the shared-chunk check of scripts/smoke-packed.mjs (#84): whether a built ES module
// exports a name renamed to a minified one. Text in, lines out: the smoke test reads the files.

const EXPORT_CLAUSE = 'export {'
// A minified export name of the bundler: one or two word characters. Anchored and bounded, so it
// cannot backtrack.
const MINIFIED_NAME = /^[\w$]{1,2}$/

/**
 * The specifiers of every `export { ... }` statement of `source` that starts a line, as
 * `{ local, exported }`; an unrenamed specifier has the same name in both.
 */
export function readExportSpecifiers(source) {
  return source
    .split('\n')
    .filter((line) => line.startsWith(EXPORT_CLAUSE))
    .flatMap((line) => {
      const end = line.indexOf('}')
      const clause = line.slice(EXPORT_CLAUSE.length, end === -1 ? line.length : end)
      return clause
        .split(',')
        .map((specifier) => specifier.trim())
        .filter((specifier) => specifier !== '')
        .map((specifier) => {
          const [local, exported = local] = specifier.split(' as ').map((name) => name.trim())
          return { local, exported }
        })
    })
}

/**
 * Each specifier of `source` that exports a name under a minified one (`globalStyles as D`), as
 * written. A rename to a full name (`isPropValid as default`, `Appearance as platformAppearance`) is
 * a public name, not a minified one, and is not listed.
 */
export function findMinifiedExports(source) {
  return readExportSpecifiers(source)
    .filter(({ local, exported }) => local !== exported && MINIFIED_NAME.test(exported))
    .map(({ local, exported }) => `${local} as ${exported}`)
}
