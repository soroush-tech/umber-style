import { extractPageStyleParts, type Cache } from '@umber-style/core'

/** The CSS of one key of a page, and the ids it covers. */
export interface StyleChunk {
  /** `<key>-global` for the rules that no class stands for, `<key>` for the rules of the classes. */
  key: string
  /** What the rules of the chunk stand for: theme classes and global ids, or class names. */
  ids: string[]
  /** The CSS text of the chunk. */
  css: string
}

/** What `extractCritical` returns: the HTML it was given, the CSS of the page, and the ids it covers. */
export interface CriticalStyles {
  /** The HTML of the page, as it was given. */
  html: string
  /** The CSS that the page needs: the rules that no class stands for, then those of its classes. */
  css: string
  /** What the rules stand for: theme classes, global ids and class names. */
  ids: string[]
}

/** What `extractCriticalToChunks` returns: the HTML it was given, and the CSS of the page in chunks. */
export interface CriticalChunks {
  /** The HTML of the page, as it was given. */
  html: string
  /** The `<key>-global` chunk, then the `<key>` chunk. */
  styles: StyleChunk[]
}

/** The server functions of one cache. */
export interface ServerInstance {
  /** The CSS that `html` needs, in one piece. */
  extractCritical(html: string): CriticalStyles
  /**
   * The CSS that `html` needs in two chunks, in this order: `<key>-global` (the layer order, the
   * `@property`, `@keyframes`, theme and global rules; its ids are the theme classes and the global ids)
   * and `<key>` (the rules of the classes of the page; its ids are the classes).
   */
  extractCriticalToChunks(html: string): CriticalChunks
  /** One `<style data-umber="<key> <ids>">` element for each chunk that has CSS, in order, as text. */
  constructStyleTagsFromChunks(chunks: Pick<CriticalChunks, 'styles'>): string
  /** `html` with the style elements of its chunks put first: right after its `<head>` when it has one, else at its start. */
  renderStylesToString(html: string): string
}

const HEAD_PATTERN = /<head(?:\s[^>]*)?>/i

/** The style element of one chunk. */
function createTag({ key, ids, css }: StyleChunk): string {
  return `<style data-umber="${[key, ...ids].join(' ')}">${css}</style>`
}

/**
 * The server functions of `cache` (an `@umber-style/cache` cache, or any engine cache), a thin layer over
 * `extractPageStyleParts`: the CSS of a page is decided from the class names in its HTML, plus the global
 * rules, the `@keyframes` rules those use and the theme classes trimmed to the variables in use. The cache
 * is not changed, so one cache can serve pages rendered at once, and the same page gets the same CSS.
 */
export default function createInstance(cache: Cache): ServerInstance {
  const key = cache.prefix

  const extractCriticalToChunks = (html: string): CriticalChunks => {
    const { global, classes } = extractPageStyleParts(cache, html)
    return {
      html,
      styles: [
        { key: `${key}-global`, ...global },
        { key, ...classes },
      ],
    }
  }

  const constructStyleTagsFromChunks = ({ styles }: Pick<CriticalChunks, 'styles'>): string =>
    styles
      .filter(({ css }) => css !== '')
      .map(createTag)
      .join('')

  return {
    extractCritical(html) {
      const { styles } = extractCriticalToChunks(html)
      return {
        html,
        css: styles.map(({ css }) => css).join(''),
        ids: styles.flatMap(({ ids }) => ids),
      }
    },
    extractCriticalToChunks,
    constructStyleTagsFromChunks,
    renderStylesToString(html) {
      const tags = constructStyleTagsFromChunks(extractCriticalToChunks(html))
      const head = HEAD_PATTERN.exec(html)
      if (head === null) return tags + html
      const headEnd = head.index + head[0].length
      return html.slice(0, headEnd) + tags + html.slice(headEnd)
    },
  }
}
