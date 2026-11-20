// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = dirname(fileURLToPath(import.meta.url))
const IMPORT_PATTERN = /(?:from|import)\s+'(\.[^']*)'/g
const HOOK_PATTERN =
  /\b(useContext|useState|useMemo|useEffect|useRef|useInsertionEffect|createContext)\b/

/** The file a relative import points to. */
function resolveImport(from: string, specifier: string): string {
  const base = join(dirname(from), specifier)
  return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((path) =>
    existsSync(path)
  ) as string
}

/** Every file that `entry` imports, directly or not, with its text. */
function walkImports(entry: string) {
  const files = new Map<string, string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (files.has(file)) continue
    const text = readFileSync(file, 'utf8')
    files.set(file, text)
    for (const [, specifier] of text.matchAll(IMPORT_PATTERN)) {
      queue.push(resolveImport(file, specifier))
    }
  }
  return files
}

describe('the server build', () => {
  const files = walkImports(join(SOURCE, 'index.server.ts'))

  it('reaches the files of the server build, and no more', () => {
    const names = [...files.keys()].map((file) =>
      file.slice(SOURCE.length + 1).replaceAll(sep, '/')
    )
    expect(names.sort()).toEqual([
      'Global.server.ts',
      'ThemeProvider.server.ts',
      'createStyle.server.ts',
      'defaultStyle.server.ts',
      'domProps.ts',
      'index.server.ts',
      'serverContext.ts',
      'styleElements.ts',
      'styled.server.ts',
      'styledParts.ts',
      'types.ts',
    ])
  })

  it('calls no hook, makes no context, and imports nothing of the client build', () => {
    for (const [file, text] of files) {
      expect(text, file).not.toMatch(HOOK_PATTERN)
      expect(text, file).not.toMatch(/ThemeValue/)
    }
  })

  it('does not import the client files of the package', () => {
    const client = ['createStyle', 'defaultStyle', 'styled', 'ThemeProvider', 'Global', 'index']
    for (const [file, text] of files) {
      for (const [, specifier] of text.matchAll(IMPORT_PATTERN)) {
        expect(client, `${file}: ${specifier}`).not.toContain(specifier.replace('./', ''))
      }
    }
  })
})
