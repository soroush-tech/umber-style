// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as core from './index'

const SOURCE = dirname(fileURLToPath(import.meta.url))
const IMPORT_PATTERN = /(?:from|import)\s+'([^']+)'/g
const FRAMEWORK_PATTERN = /^(react|react-dom|react-native|vue)(\/|$)/
const BINDING_PATTERN = /(^|\/)(react|react-native|vue)(\/|$)/

/** The file a relative import points to. */
function resolveImport(from: string, specifier: string): string {
  const base = join(dirname(from), specifier)
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
  return candidates.find((candidate) => existsSync(candidate)) as string
}

/** Every file that `entry` imports, directly or not, and every import specifier on the way. */
function walkImports(entry: string) {
  const files = new Set<string>()
  const specifiers: string[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (files.has(file)) continue
    files.add(file)
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
      specifiers.push(specifier)
      if (specifier.startsWith('.')) queue.push(resolveImport(file, specifier))
    }
  }
  return { files, specifiers }
}

describe('the core', () => {
  it('imports no framework and no binding', () => {
    const { files, specifiers } = walkImports(join(SOURCE, 'index.ts'))
    expect(files.size).toBeGreaterThan(10)
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(FRAMEWORK_PATTERN)
      expect(specifier).not.toMatch(BINDING_PATTERN)
    }
  })

  it('exports the engine and its parts', () => {
    for (const name of ['createEngine', 'createCache', 'createStyleTag', 'mergeStyles', 'alpha']) {
      expect(core).toHaveProperty(name)
    }
    expect(core).not.toHaveProperty('createStyle')
  })
})
