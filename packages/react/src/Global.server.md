# Global.server.ts

Build: server (components build, no hook and no context). The client counterpart is `Global.ts`.

## What it does

`createGlobal(engine, readTheme, readNonce, sendStyles)` makes the `Global` for server components. It resolves
the global styles against the view of `readTheme()`, writes every set into the cache for good, and returns the
style of the sets and of the animations they use (`sendStyles` of the texts of `collectGlobalTexts`),
followed by a `GlobalRelease` element when any set has rules.

## Why it exists

A server component cannot use a hook or an effect, and nothing unmounts on a server, so the rules are
written once during the render and sent as elements. The browser still needs to know about them, so that a
navigation away can release them: that is the job of the client component `GlobalRelease`, which this file
renders with the sets as plain JSON text. `createStyle.server.ts` is the importer.

## The logic

```mermaid
flowchart TD
  styles["props.styles"] --> view["createThemeView(readTheme())"]
  view --> resolve["readGlobalSets: the sets of the same styles and view, else engine.resolveGlobal"]
  resolve --> each["insertGlobal(set, isRendered) for each set"]
  each --> filter["keep sets with rules"]
  filter --> any{"any set with rules?"}
  any -->|no| noRelease["no release element"]
  any -->|yes| release["GlobalRelease: prefix, sets as JSON text"]
  filter --> els["sendStyles(collectGlobalTexts(cache, sets), the nonce of the request)"]
  els --> inline{"inline mode: a nonce in the request?"}
  inline -->|no| hoisted["style href precedence nonce elements, as in 0.6.0"]
  inline -->|yes| nonceStyles["one NonceStyles with the texts"]
  hoisted --> frag
  nonceStyles --> frag
  noRelease --> frag["Fragment: the style, then release"]
  release --> frag
```

## The data

The props of `GlobalRelease`: `prefix` (the cache prefix) and `sets`, the `JSON.stringify` of `[id, rules][]`.

## What it guarantees

- No hook, no context. `serverGuard.test.ts` checks that the files of the server build call none.
- `GlobalRelease` is imported from a `'use client'` file, so in a bundler of server components the import is
  a reference to it; it is never run on the server (`vitest.clientReferences.ts` mocks it the same way).
- Each `href` is sent once, however many components render the same set: React sends a hoisted element
  once, and in inline mode (a request with a nonce, from a source or the cache) `NonceStyles` shows a text in place once
  in the request (`inlineStyles.server.ts`).
- The style carries the nonce of the request (`readNonce`): the cache's, or the answer of the source
  registered with `setNonceSource`; it returns a Promise of its elements while that has not come.

## Decisions

- The sets are sent as text, not as an object, so the same sets in a new payload are equal (comment in
  `GlobalRelease.ts`).
- The view of the theme comes from `readTheme`: base theme, else the first provider of the request, else empty.
- The sets are those of `readGlobalSets` (`styleElements.ts`): a render with the styles and the view of a
  render before gets the sets resolved then, so a function of the theme is not called again (nor the `css`
  template it returns read again).

## Limits

- Nothing is released on the server: the rules stay in the cache for the life of the process.
