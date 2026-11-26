// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as core from './index'

const SOURCE = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(SOURCE, '../package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  peerDependencies?: Record<string, string>
}
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
  it('imports no framework and no binding, from either entry', () => {
    for (const entry of ['index.ts', 'internal.ts']) {
      const { files, specifiers } = walkImports(join(SOURCE, entry))
      expect(files.size).toBeGreaterThan(10)
      for (const specifier of specifiers) {
        expect(specifier).not.toMatch(FRAMEWORK_PATTERN)
        expect(specifier).not.toMatch(BINDING_PATTERN)
      }
    }
  })

  it('imports csstype for types only, so the core has no runtime dependency', () => {
    const { files, specifiers } = walkImports(join(SOURCE, 'index.ts'))
    expect(specifiers).toContain('csstype')
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const { index } of source.matchAll(/from\s+'csstype'/g)) {
        // The start of the statement that this import ends: with `verbatimModuleSyntax`, only an
        // `import type` is erased from the build.
        const start =
          Math.max(source.lastIndexOf('\nimport ', index), source.lastIndexOf('\nexport ', index)) +
          1
        expect(source.slice(start, index)).toMatch(/^import type /)
      }
      expect(source).not.toMatch(/import\(\s*'csstype'/)
    }
    // It is listed as a dependency, so that the types in the declarations resolve for a consumer.
    expect(manifest.dependencies).toHaveProperty('csstype')
    expect(manifest.peerDependencies).toBeUndefined()
  })

  it('exports the engine and its parts', () => {
    for (const name of [
      'createEngine',
      'createCache',
      'createStyleTag',
      'mergeStyles',
      'alpha',
      'multiply',
      'divide',
      'add',
      'subtract',
      'negate',
      'keyframes',
      'globalStyles',
      'isLiveValue',
    ]) {
      expect(core).toHaveProperty(name)
    }
    expect(core).not.toHaveProperty('createStyle')
  })

  it('has every value it exports in the table of docs/plain-javascript.md, and nothing else there', () => {
    const page = readFileSync(join(SOURCE, '../../../docs/plain-javascript.md'), 'utf8')
    const start = page.indexOf('## Everything `@umber-style/core` exports')
    const section = page.slice(start, page.indexOf('\n## ', start + 1))
    const listed = section
      .split('\n')
      .filter((line) => line.startsWith('| `'))
      .flatMap((line) => [...line.split('|')[1].matchAll(/`(\w+)`/g)].map(([, name]) => name))
    expect(start).toBeGreaterThan(0)
    expect(listed.length).toBe(new Set(listed).size)
    expect([...listed].sort()).toEqual(Object.keys(core).sort())
  })
})
