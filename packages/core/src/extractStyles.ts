import type { Cache } from './cache'
import { scanHtml } from './scanHtml'

/** The style element of `css`: the cache's key, and the stamp of its options for the browser to compare. */
function createTag(cache: Cache, css: string): string {
  return `<style data-style="${cache.prefix}" data-options="${cache.fingerprint}">${css}</style>`
}

/**
 * The style element of a static page or a server render: everything `cache` inserted, whatever page
 * inserted it. A cache that renders more than one page (a server process) should use `extractPageStyles`,
 * which carries only what one page uses. The element is stamped with the options of the cache
 * (`data-options`), which a cache made in the browser compares with its own; it holds no list of ids,
 * because the browser reads the rules themselves.
 */
export function createStyleTag(cache: Cache): string {
  return createTag(cache, cache.extract().css)
}

/** What one page needs: its CSS, what that CSS covers, and the element to put in its head. */
export interface PageStyles {
  /** The CSS of the page: the layer order, the `@property` rules, the `@keyframes` rules, the themes, the rules of its classes. */
  css: string
  /** The theme classes and the classes that `css` has rules for. */
  ids: string[]
  /** The stamp of the options of the cache: the `data-options` of the style element, for a page that writes the element itself. */
  options: string
  /** The style element with `css`, stamped with the options of the cache. */
  tag: string
}

export interface PageStyleOptions {
  /** Theme classes (`themeClass(...)` results, or their first class) to include although no element of `html` has them: the themes the page offers for switching, and the one on `<html>`, which `html` does not hold when it is the markup of the root only. They get the variables that the page uses, like the others. */
  themes?: readonly string[]
  /** Animation names (`keyframes` results) whose `@keyframes` rule to include although no class of `html` uses them: for a use the engine cannot see. Names that `keyframes` did not return are ignored. */
  animations?: readonly string[]
}

/**
 * The CSS of one page, decided from the page: the finished `html` is scanned for the class names it
 * holds (the values of its `class` and `className` attributes only; scripts, styles, comments and other
 * attributes are not looked at), and only those classes are written, with the `@keyframes` rules they
 * use and the theme classes trimmed to the variables that the page uses. Nothing depends on what else the cache holds, on the
 * order pages were rendered in, or on pages being rendered at the same time, and the cache is not changed.
 * The `<style href precedence>` elements that `html` carries already (React's server render of the
 * client build emits them) are not written again.
 */
export function extractPageStyles(
  cache: Cache,
  html: string,
  options: PageStyleOptions = {}
): PageStyles {
  const { classes, carried } = scanHtml(html)
  const themes = (options.themes ?? []).flatMap((value) => value.split(/\s+/))
  const { css, ids } = cache.extractPage(classes, {
    themes,
    animations: options.animations,
    carried,
  })
  return { css, ids, options: cache.fingerprint, tag: createTag(cache, css) }
}
