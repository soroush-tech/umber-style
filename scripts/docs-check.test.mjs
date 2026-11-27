import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findDeadLinks,
  findReservedIds,
  readAnchors,
  readLinks,
  readNodeIds,
  slugify,
} from './docs-check.mjs'

const fence = '```'
const graph = (...lines) => ['# T', '', `${fence}mermaid`, ...lines, fence, ''].join('\n')

describe('readNodeIds', () => {
  it('reads the ids at the start of a statement and after an edge', () => {
    assert.deepEqual(readNodeIds('  a["x"] --> b{"y?"} -->|yes| c(round) --> d>flag]'), [
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('reads a bare id after an edge, and ids joined by & or ;', () => {
    assert.deepEqual(readNodeIds('a --> b & c; d --> e'), ['a', 'b', 'c', 'd', 'e'])
  })

  it('reads the id after subgraph, and a node with a class suffix', () => {
    assert.deepEqual(readNodeIds('subgraph box["t"]'), ['box'])
    assert.deepEqual(readNodeIds('a:::hot --> b'), ['a', 'b'])
  })

  it('skips quoted text, brackets inside brackets and edge labels', () => {
    assert.deepEqual(readNodeIds('a["a] call[x]"] -->|"to end"| b{"(x)"}'), ['a', 'b'])
    assert.deepEqual(readNodeIds('a -.-> b == c'), ['a', 'b', 'c'])
    assert.deepEqual(readNodeIds('a[b(c)] --> "q" d'), ['a', 'd'])
  })

  it('does not take keywords and their arguments for ids', () => {
    for (const line of ['flowchart TD', 'style a fill:#fff', 'classDef default fill:#fff', 'end'])
      assert.deepEqual(readNodeIds(line), [])
  })

  it('survives text that never closes', () => {
    assert.deepEqual(readNodeIds('a["open'), ['a'])
    assert.deepEqual(readNodeIds('a[open'), ['a'])
    assert.deepEqual(readNodeIds('a -->|open'), ['a', 'open'])
    assert.deepEqual(readNodeIds('a --> | b'), ['a', 'b'])
    assert.deepEqual(readNodeIds('a ~ ? b'), ['a', 'b'])
  })
})

describe('findReservedIds', () => {
  it('names the line and the id of each reserved one', () => {
    const text = graph('flowchart TD', '  call["x"] --> end', '  a --> style[y]')
    assert.deepEqual(findReservedIds(text), [
      { line: 5, id: 'call' },
      { line: 5, id: 'end' },
      { line: 6, id: 'style' },
    ])
  })

  it('leaves a closing end, other fences and a clean graph alone', () => {
    assert.deepEqual(findReservedIds(graph('flowchart TD', 'subgraph s', 'a --> b', 'end')), [])
    assert.deepEqual(findReservedIds(`${fence}ts\ncall["x"] --> end\n${fence}\n`), [])
    assert.deepEqual(
      findReservedIds(graph('flowchart TD', 'invoked --> b').replace('\n', '\r\n')),
      []
    )
  })
})

describe('slugify', () => {
  it('lowers, drops punctuation and turns spaces into hyphens', () => {
    assert.equal(slugify('The CSS of one page'), 'the-css-of-one-page')
    assert.equal(slugify('Benchmark: `Emotion`, v1.0 (x)'), 'benchmark-emotion-v10-x')
    assert.equal(slugify('snake_case - and  two'), 'snake_case---and--two')
  })

  it('keeps the text of a link and drops its target', () => {
    assert.equal(slugify('See [the page](a.md) now [open'), 'see-the-page-now-open')
    assert.equal(slugify('[a [b](c.md)'), 'a-b')
    assert.equal(slugify('[a](c.md'), 'acmd')
  })
})

describe('readAnchors', () => {
  it('reads the headings outside fences, and numbers a repeat', () => {
    const text = [
      '# One',
      '## Two ##',
      '#NotOne',
      'plain text',
      '####### Seven',
      `${fence}`,
      '# In',
      fence,
      '## Two',
      '### Two',
    ].join('\n')
    assert.deepEqual(readAnchors(text), ['one', 'two', 'two-1', 'two-2'])
  })

  it('takes a hash that ends the text for a heading with an empty name', () => {
    assert.deepEqual(readAnchors('## C #\r\n##\r\n'), ['c'])
  })
})

describe('readLinks', () => {
  it('reads the targets, without the title', () => {
    assert.deepEqual(readLinks('See [a](a.md#x) and [b](b.md "tip"), [c](#y).'), [
      'a.md#x',
      'b.md',
      '#y',
    ])
  })

  it('skips code spans, fenced blocks, brackets with no target and a link that never closes', () => {
    const text = [
      '`[a](gone.md)` [b] [c](d.md',
      '`open [h](i.md)',
      `${fence}`,
      '[j](k.md)',
      fence,
    ].join('\n')
    assert.deepEqual(readLinks(text), [])
  })
})

describe('findDeadLinks', () => {
  const pages = {
    'docs/a.md':
      '# A\n\n[b](b.md#top) [self](#a) [bad](#nope) [x](https://x.test/#y) [m](mailto:a@b.c)\n',
    'docs/b.md': '# Top\n',
    'docs/img.png': '',
  }
  const context = {
    resolve: (from, to) => `docs/${to}`,
    readPage: (path) => pages[path] ?? null,
  }

  it('finds a missing heading, a missing page and a missing heading in another page', () => {
    const text = [
      '[ok](b.md#top) [self](#a) [dec](b.md#to%70) [bad](#nope) [gone](gone.md) [no](b.md#nope)',
      '[img](img.png#x) [here](#) [empty]() [pct](b.md#%E0%A4%A)',
      '[ext](https://x.test/#y) [prot](//x.test) [mail](mailto:a@b.c)',
    ].join('\n')
    assert.deepEqual(findDeadLinks('docs/a.md', `# A\n${text}`, context), [
      'docs/a.md: #nope - no such heading',
      'docs/a.md: gone.md - no such page',
      'docs/a.md: b.md#nope - no such heading',
      'docs/a.md: b.md#%E0%A4%A - no such heading',
    ])
  })

  it('finds nothing wrong in a page whose links all land', () => {
    assert.deepEqual(findDeadLinks('docs/b.md', '# Top\n[a](a.md) [t](#top)', context), [])
  })
})
