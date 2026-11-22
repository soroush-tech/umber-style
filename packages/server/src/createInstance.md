# createInstance.ts

## What it does

`createInstance(cache)` returns the server functions of one cache: `extractCriticalToChunks(html)` gives
the CSS a page needs in two chunks, `extractCritical(html)` gives it in one piece,
`constructStyleTagsFromChunks(chunks)` writes `<style data-umber>` elements, and
`renderStylesToString(html)` puts those elements into the HTML. The subpath
`@umber-style/server/create-instance` exports it as the default.

## Why it exists

A server render must send the CSS of the page it rendered, and a browser must be able to tell which rules
those elements already hold. The decision of what a page needs is in the core (`extractPageStyleParts`).
This file is the thin layer that names the chunks after the cache key and writes them as tags. The tests
of `server` (`appSetUp`, `hydration`, `pageGlobal`, `registry`, `sharedCache`) and the fixture app use it.
It knows no framework.

## The logic

```mermaid
flowchart TD
  html["html string"] --> parts["extractPageStyleParts(cache, html)"]
  parts --> global["global: layer order, @property, keyframes, theme and global rules"]
  parts --> classes["classes: the rules of the classes found in the html"]
  global --> chunks["styles: { key-global } then { key }"]
  classes --> chunks
  chunks --> one["extractCritical: join css, flatten ids"]
  chunks --> tags["constructStyleTagsFromChunks"]
  tags --> filter{"css is ''?"}
  filter -->|yes| drop["no element for that chunk"]
  filter -->|no| tag["style data-umber='key ids...' css"]
  tag --> render["renderStylesToString"]
  render --> head{"html has a head tag?"}
  head -->|yes| afterHead["tags right after the head"]
  head -->|no| atStart["tags at the start"]
```

The `data-umber` value is the chunk key followed by its ids, separated by spaces. The cache package reads
the same attribute on the client (the first word is the key, the rest are names it will not write again).

## The data

- `StyleChunk`: `{ key, ids, css }`. `key` is `<cacheKey>-global` or `<cacheKey>`.
- Example from the test: `<style data-umber="app-global ...">@layer app-theme,app-global,app-components,app-overrides;@layer app-global{body{margin:0;}}</style>`.
- `CriticalStyles`: `{ html, css, ids }`; `CriticalChunks`: `{ html, styles }`.

## What it guarantees

- The cache is not changed, so one cache can serve pages rendered at once; the same page gets the same
  CSS (test "gives the same output for the same page, and keeps two caches apart").
- The global chunk comes first, then the classes chunk.
- A chunk with no CSS gets no element.
- `html` is returned as given, in `extractCritical` and `extractCriticalToChunks`.
- No browser global is used.

## Decisions

- The key of each chunk comes from `cache.prefix`.
- The head is found with `/<head(?:\s[^>]*)?>/i`, so `<header>` is not a head; with no head, such as a
  fragment, the tags go at the start.

## Limits

- Only the first `<head ...>` is used, and the pattern does not understand a `>` inside an attribute
  value of the head tag. No test covers that.
- It extracts from the class names present in the HTML string; a class made after the HTML was built is
  not seen.
