# Global.ts

Build: client (the `Global` that `createStyle.ts` makes). Its server counterpart is `Global.server.ts`.

## What it does

`createGlobal(engine, useThemeView, createServerElements)` makes the `Global` component. It resolves the
global styles of its props against the view of the theme, writes the resulting sets into the cache, and
renders nothing in the browser. Where there is no document it also renders the style elements, or the
marker, that name the sets; under a `StyleRegistry` the registry takes their texts and nothing is rendered
(`createStyle.ts`).

## Why it exists

Global rules (`body { margin: 0 }`, `@keyframes`) must exist while a component is mounted, go when it
unmounts, and follow the theme. This file ties that lifecycle to React. `createStyle.ts` is the only
importer; it passes in its own `useThemeView` and a function that picks style elements or the marker.

## The logic

```mermaid
flowchart TD
  props["props.styles"] --> cache["useProvidedCache(), useStyleRegistry()"]
  cache --> local{"cache given?"}
  local -->|yes| over["engine.withCache(cache)"]
  local -->|no| own["engine"]
  over --> view["useThemeView(cache)"]
  own --> view
  view --> sets{"useMemo: document defined?"}
  sets -->|"yes: the browser"| resolveNow["resolveGlobal(styles, view)"]
  sets -->|"no: a server render"| keptSets["readGlobalSets: the sets of the same styles and view, else resolveGlobal"]
  resolveNow --> effect
  keptSets --> effect
  effect["insertion effect"]
  effect --> write["insertSets: write the new sets"]
  write --> drop["release the previous sets"]
  effect --> doc{"document defined?"}
  doc -->|yes| null["return null"]
  doc -->|no| forever["insertSets during render, never released"]
  forever --> elems["createServerElements(sets, cache, registry)"]
  elems --> out["Fragment of elements, or null"]
```

## The data

A set is a `GlobalRules`: `{ id, rules, animations }`. `held` is a ref to the function that releases every
set the component wrote.

## What it guarantees

- When the sets change, the new ones are written before the old ones are released, so there is no moment
  with neither.
- The cache counts the rules of a set: two elements with equal styles share them, and an effect that runs
  twice in development writes them back.
- On unmount the held rules are released and the ref goes back to a no-op.
- Where there is no document, nothing unmounts, so the rules are written during the render and kept.
- The hooks are the same on every render, with or without a provider.

## Decisions

- Insertion effects, not layout effects, so the rules are in the sheet before the page changes.
- Two insertion effects: one for write-then-release on a change, one that releases only on unmount.
- The server branch writes during render because no effect runs there (a comment in the code says so).
- Where there is no document, the sets come from `readGlobalSets` (`styleElements.ts`): a server renders
  each request from nothing, so the memo of the component never sees the render before, and a function of
  the theme was called (and the `css` template it returns read) in every render. Now a render with the
  styles and the view of a render before takes the sets made then, as the memo does across renders in the
  browser. In the browser nothing changes: the memo of the component decides, as before. On a design
  system's home page, `Global` with a function of the theme was 15% of a server render.

## Limits

- It does not remove a set whose element a server render sent, by itself; it relies on the cache taking
  over those rules (see `GlobalRelease.ts` for the server-component case).
