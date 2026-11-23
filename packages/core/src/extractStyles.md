# extractStyles.ts

## What it does

Turns what a cache holds into style elements for a server render. `createStyleTag(cache)` gives one `<style>`
element with everything the cache inserted. `extractPageStyles(cache, html, options)` gives the CSS of one
page, decided from its finished markup, together with the ids it covers, the stamp of the options and the
element. `extractPageStyleParts` gives the same CSS in two parts. `createNonceAttribute(nonce)` writes the
` nonce="..."` attribute of a tag, escaped, which the tags here and those of `@umber-style/server` carry.

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
  all --> nonce{"a nonce: of the options, else of the cache?"}
  nonce -->|yes| withNonce["style element with data-style, data-options and nonce, escaped"]
  nonce -->|no| wrap["style element with data-style and data-options"]
  page["extractPageStyles(cache, html, options)"] --> scan["scanHtml(html): classes, carried, rendered"]
  scan --> themes["options.themes: each value split on whitespace"]
  themes --> ask["cache.extractPage(classes, themes, animations, carried, rendered)"]
  ask --> res["css and ids"]
  res --> out["{ css, ids, options: fingerprint, tag }: the tag with the nonce of the options, else of the cache"]
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
though no class uses them). `StyleTagOptions` holds `nonce`, which `createStyleTag` takes, and
`extractPageStyles` takes next to `PageStyleOptions`. The tag looks like
`<style data-style="umber" data-options="p=umber;..." nonce="...">...</style>`, the nonce last and only when
there is one.

## What it guarantees

- A page's CSS does not depend on what else the cache holds, on the order pages were rendered in, or on
  pages rendered at the same time; the cache is not changed (the doc comment).
- Global rules inserted for the app are in every page; those of a `Global` component are in a page only when
  its HTML carries a style element or a marker that names the set.
- `<style href precedence>` elements already in the HTML are not written again.
- `parts.css` joined in order equals the CSS of `extractPageStyles`.
- A nonce is in the tag only: never in `css`, `ids` or `options`, so it changes no class name, hash or stamp.
  `&`, `"`, `<` and `>` of it are written as entities, so a nonce cannot end the attribute or the tag.

## Decisions

- `createStyleTag` holds no list of ids: the browser reads the rules themselves.
- The nonce of a call wins over the cache's: a cache that a server process shares serves requests that
  each have a nonce of their own, and the call is where the request is known. A cache made for one request
  (`@umber-style/cache`) can hold it instead.
- The escaping is a loop over the characters with a table, not a pattern, and covers what can end or open
  something in a value in double quotes; a nonce of a policy is base64 in practice, which has none of them.
- The unscoped `createStyleTag` stays for static pages; the doc comment says a cache that serves many pages
  should use `extractPageStyles`.

## Limits

- Class names that a script adds at run time are not in the HTML, so their rules are not in the page; the
  `themes` and `animations` options exist for uses the scan cannot see.
- `extractPageStyleParts` gives CSS, not a tag, so it takes no nonce: whoever writes the elements of its
  parts adds it (`createNonceAttribute`).
