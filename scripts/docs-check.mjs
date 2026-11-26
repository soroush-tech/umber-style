// The pure part of scripts/check-docs.mjs: the node ids a sidecar graph may not use, and the links of
// a page that point at nothing. Text in, lines out: the CLI reads the files.

export const RESERVED_IDS = ['style', 'call', 'class', 'default', 'end', 'click', 'graph']

const BRACKETS = { '[': ']', '(': ')', '{': '}' }
const EDGE_CHARS = '-=.~<>'
const FENCE = '```'
const isWordChar = (char) => /\w/.test(char)

/** The lines of every fenced block of `text` as `{ info, lines, start }`; `start` is the line number of its first line. */
function readFences(text) {
  const blocks = []
  let open = null
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith(FENCE) && open === null) {
      open = { info: trimmed.slice(3).trim(), lines: [], start: index + 2 }
    } else if (trimmed.startsWith(FENCE)) {
      blocks.push(open)
      open = null
    } else if (open !== null) {
      open.lines.push(line)
    }
  })
  return blocks
}

/** The index after the quote that closes the one at `from`, or the end of the line. */
function skipQuoted(line, from) {
  const close = line.indexOf('"', from + 1)
  return close === -1 ? line.length : close + 1
}

/** The index after the bracket that closes the one at `from` (quoted text inside is skipped), or the end. */
function skipBracket(line, from) {
  const stack = [BRACKETS[line[from]]]
  let index = from + 1
  while (index < line.length && stack.length > 0) {
    const char = line[index]
    if (char === '"') {
      index = skipQuoted(line, index)
      continue
    }
    if (char === stack[stack.length - 1]) stack.pop()
    else if (BRACKETS[char]) stack.push(BRACKETS[char])
    index += 1
  }
  return index
}

/** The index after the run of edge characters at `from` (`-->`, `==>`, `-.->`). */
function skipEdge(line, from) {
  let index = from
  while (index < line.length && EDGE_CHARS.includes(line[index])) index += 1
  return index
}

/** The index after the word at `from`. */
function skipWord(line, from) {
  let index = from
  while (index < line.length && isWordChar(line[index])) index += 1
  return index
}

/** Whether what follows the word that ended at `index` makes it a node: a shape, an edge or a join. */
function startsNode(line, index, afterEdge) {
  let next = index
  while (line[next] === ' ') next += 1
  if (next >= line.length) return afterEdge
  const char = line[next]
  return Boolean(BRACKETS[char]) || EDGE_CHARS.includes(char) || '&:;'.includes(char)
}

/**
 * The words of one graph line that are node ids: the word at the start of a statement or after an edge
 * (or `&`), followed by a shape, an edge, a join or, after an edge, the end of the line. A word that
 * opens a statement and is followed by another word (`style a fill:...`, `classDef default ...`) is a
 * keyword, not an id; the word after `subgraph` is one.
 */
export function readNodeIds(line) {
  const ids = []
  let expecting = true
  let afterEdge = false
  let previous = ''
  let index = 0
  while (index < line.length) {
    const char = line[index]
    if (char === '"') index = skipQuoted(line, index)
    else if (BRACKETS[char]) index = skipBracket(line, index)
    else if (char === '|') index = Math.max(line.indexOf('|', index + 1) + 1, index + 1)
    else if (char === '&' || char === ';' || EDGE_CHARS.includes(char)) {
      index = char === '&' || char === ';' ? index + 1 : skipEdge(line, index)
      expecting = true
      afterEdge = char !== ';'
    } else if (isWordChar(char)) {
      const end = skipWord(line, index)
      if ((expecting || previous === 'subgraph') && startsNode(line, end, afterEdge))
        ids.push(line.slice(index, end))
      previous = line.slice(index, end)
      expecting = false
      afterEdge = false
      index = end
    } else index += 1
  }
  return ids
}

/** `{ line, id }` for each reserved node id in each `mermaid` graph of a page (`line` counts from 1). */
export function findReservedIds(text) {
  const found = []
  for (const block of readFences(text).filter(({ info }) => info === 'mermaid'))
    block.lines.forEach((line, offset) => {
      for (const id of readNodeIds(line))
        if (RESERVED_IDS.includes(id)) found.push({ line: block.start + offset, id })
    })
  return found
}

/** The lines of `text` that are not inside a fenced block. */
function linesOutsideFences(text) {
  const kept = []
  let inside = false
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith(FENCE)) inside = !inside
    else if (!inside) kept.push(line)
  }
  return kept
}

/** `{ label, target, end }` of the link `[label](target)` that starts at `from`, or null. */
function readLinkAt(line, from) {
  if (line[from] !== '[') return null
  const split = line.indexOf('](', from)
  if (split === -1 || line.slice(from + 1, split).includes('[')) return null
  const close = line.indexOf(')', split)
  if (close === -1) return null
  const [target] = line
    .slice(split + 2, close)
    .trim()
    .split(' ')
  return { label: line.slice(from + 1, split), target, end: close + 1 }
}

/** GitHub's anchor of a heading: links reduced to their text, lower case, punctuation removed, spaces to hyphens. */
export function slugify(heading) {
  let plain = ''
  let index = 0
  while (index < heading.length) {
    const link = readLinkAt(heading, index)
    plain += link ? link.label : heading[index]
    index = link ? link.end : index + 1
  }
  return [...plain.toLowerCase()]
    .filter((char) => /[\p{L}\p{N}_ -]/u.test(char))
    .join('')
    .replaceAll(' ', '-')
}

/** The text of an ATX heading line (`## Title ##`), or null for any other line. */
function readHeading(line) {
  let level = 0
  while (line[level] === '#') level += 1
  if (level === 0 || level > 6 || line[level] !== ' ') return null
  let text = line.slice(level).trim()
  while (text.endsWith(' #') || text.endsWith('##')) text = text.slice(0, -1).trimEnd()
  return text
}

/** The anchors of a page, in order, with a repeated one numbered the way GitHub numbers it (`a`, `a-1`). */
export function readAnchors(text) {
  const seen = new Map()
  const anchors = []
  for (const line of linesOutsideFences(text)) {
    const heading = readHeading(line)
    if (heading === null) continue
    const slug = slugify(heading)
    const count = seen.get(slug) ?? 0
    seen.set(slug, count + 1)
    anchors.push(count === 0 ? slug : `${slug}-${count}`)
  }
  return anchors
}

/** The targets of the links of a page, outside fenced blocks and code spans. */
export function readLinks(text) {
  const targets = []
  for (const line of linesOutsideFences(text)) {
    let index = 0
    while (index < line.length) {
      if (line[index] === '`') {
        const close = line.indexOf('`', index + 1)
        index = close === -1 ? line.length : close + 1
        continue
      }
      const link = readLinkAt(line, index)
      if (link) targets.push(link.target)
      index = link ? link.end : index + 1
    }
  }
  return targets
}

const isExternal = (target) => target.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * What is wrong with the links of the page at `file` (a repository path with `/`): one line for each
 * link to a page that does not exist, or to a heading that page has no anchor for. `resolve(from, to)`
 * gives the repository path of a link written in `from`; `readPage(path)` is the text of a page, or
 * null when there is none. Links to anything that is not Markdown are checked for existing only.
 */
export function findDeadLinks(file, text, { resolve, readPage }) {
  const problems = []
  for (const target of readLinks(text)) {
    if (target === '' || isExternal(target)) continue
    const hash = target.indexOf('#')
    const path = hash === -1 ? target : target.slice(0, hash)
    const anchor = hash === -1 ? '' : safeDecode(target.slice(hash + 1))
    const destination = path === '' ? file : resolve(file, safeDecode(path))
    const page = destination === file ? text : readPage(destination)
    if (page === null) problems.push(`${file}: ${target} - no such page`)
    else if (anchor !== '' && destination.endsWith('.md') && !readAnchors(page).includes(anchor))
      problems.push(`${file}: ${target} - no such heading`)
  }
  return problems
}
