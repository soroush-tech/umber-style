# extractStyles.ts

## What it does

Turns what a cache holds into style elements for a server render. `createStyleTag(cache)` gives one `<style>`
element with everything the cache inserted. `extractPageStyles(cache, html, options)` gives the CSS of one
page, decided from its finished markup, together with the ids it covers, the stamp of the options and the
element. `extractPageStyleParts` gives the same CSS in two parts.

## Why it exists

A static page or a server render has to ship the rules its markup uses. A cache that lives for a whole
process holds the rules of every page it ever rendered, so taking all of it leaks the rules of other pages
and depends on render order. `extractPageStyles` reads the class names out of the HTML and asks the cache for
only those rules, so the result depends on the page alone. The element carries the stamp of the cache's
options (`data-options`) for the browser to compare (see `fingerprint.ts`). It is used by `index.ts` (the
public export), `packages/server/src/createInstance.ts`, `packages/react/src/styleElements.ts` and
`packages/vue/src/Global.ts`.

## The logic

```mermaid
flowchart TD
  tag["createStyleTag(cache)"] --> all["cache.extract().css: everything inserted"]
  all --> wrap["style element with data-style and data-options"]
  page["extractPageStyles(cache, html, options)"] --> scan["scanHtml(html): classes, carried, rendered"]
  scan --> themes["options.themes: each value split on whitespace"]
  themes --> ask["cache.extractPage(classes, themes, animations, carried, rendered)"]
  ask --> res["css and ids"]
  res --> out["{ css, ids, options: fingerprint, tag }"]
  parts["extractPageStyleParts(cache, html, options)"] --> scan2["same reading of the page"]
  scan2 --> ask2["cache.extractPageParts(...)"]
  ask2 --> two["rules no class stands for, then the rules of the classes"]
```

`readPage` is the shared step: it scans the markup and shapes the options for the cache. The scan reads
only the values of `class` and `className` attributes (scripts, styles, comments and other attributes are
not read), and finds style elements and markers the page already carries.

## The data

`PageStyles` is `{ css, ids, options, tag }`. `PageStyleOptions` holds `themes` (theme classes to include
though no element has them, such as the one on `<html>`) and `animations` (names of `keyframes` to include
though no class uses them). The tag looks like `<style data-style="umber" data-options="p=umber;...">...</style>`.

## What it guarantees

- A page's CSS does not depend on what else the cache holds, on the order pages were rendered in, or on
  pages rendered at the same time; the cache is not changed (the doc comment).
- Global rules inserted for the app are in every page; those of a `Global` component are in a page only when
  its HTML carries a style element or a marker that names the set.
- `<style href precedence>` elements already in the HTML are not written again.
- `parts.css` joined in order equals the CSS of `extractPageStyles`.

## Decisions

- `createStyleTag` holds no list of ids: the browser reads the rules themselves.
- The unscoped `createStyleTag` stays for static pages; the doc comment says a cache that serves many pages
  should use `extractPageStyles`.

## Limits

- Class names that a script adds at run time are not in the HTML, so their rules are not in the page; the
  `themes` and `animations` options exist for uses the scan cannot see.
