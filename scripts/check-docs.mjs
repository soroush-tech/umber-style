// Two guards on the Markdown of the repository, run by the pre-commit hook and the CI lint job:
//
// 1. No `mermaid` graph in any page uses a reserved word as a node id.
// 2. No link in docs/ points to a page or a heading that does not exist.
//
// Run `pnpm check:docs`. The decisions are in docs-check.mjs, which has the tests.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findDeadLinks, findReservedIds } from './docs-check.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: repoRoot, encoding: 'utf8' }
)
  .split('\0')
  .filter((file) => file.endsWith('.md') && existsSync(join(repoRoot, file)))

const readPage = (path) => {
  const absolute = join(repoRoot, path)
  if (!existsSync(absolute)) return null
  return statSync(absolute).isDirectory() ? '' : readFileSync(absolute, 'utf8')
}
const joinPath = (from, to) =>
  relative(repoRoot, resolve(repoRoot, dirname(from), to)).replaceAll('\\', '/')

const problems = []
for (const file of files) {
  const text = readFileSync(join(repoRoot, file), 'utf8')
  for (const { line, id } of findReservedIds(text))
    problems.push(`${file}:${line}: node id "${id}" is a reserved word of the graph syntax`)
  if (file.startsWith('docs/'))
    problems.push(...findDeadLinks(file, text, { resolve: joinPath, readPage }))
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Checked ${files.length} pages: no reserved node id, no dead link in docs/.`)
