# fixtures.ts

## What it does

Makes the process run built code, then loads Vue, `vue/server-renderer`, the built binding
(`dist/index.cjs`) and the built core. It exports `createSetup()` (a fresh style object over an in-memory
cache and the components `Fixed`, `Themed`, `Flex`, `Cell` and a sheet), the type `Setup`,
`createFortyEight(setup, kind)`, `createTree(setup, shift)`, `createNested(setup)` and `prepare(children)`.

## Why it exists

The benchmark files `render-elements`, `render-trees`, `dom-trees` and `dom-hydration` measure the Vue
binding as an app loads it. The sandbox sets no `NODE_ENV` and the workspace link of the core points at
source, so `prepareBuiltPackages` runs first and Vue, the renderer and the binding load after it with
`createRequire` (`docs/benchmarks.md`). A static import would be resolved before the hook. The
components are made from the shared styles of `bench/src`, with this binding's `styled`.

## The logic

```mermaid
flowchart TD
  prep["prepareBuiltPackages: production, core to dist"] --> load["load vue, vue/server-renderer, dist/index.cjs, core dist"]
  load --> cs["createSetup: createStyle(theme, memory cache), styled components, a sheet"]
  cs --> kind{"kind given to createFortyEight"}
  kind -->|fixed| a["h(Fixed)"]
  kind -->|themed| b["h(Themed)"]
  kind -->|flex| c["h(Flex, combination)"]
  kind -->|override| d["Fixed with a style object"]
  kind -->|entry| e["Fixed with sheet.root"]
  cs --> tree["createTree: 100 rows, 4 Cell each, moved by shift"]
  cs --> nest["createNested: two providers around 48 themed"]
  a --> pr["prepare(children)"]
  tree --> pr
  pr --> warm["createSSRApp inside ThemeProvider, one render"]
  warm --> op["returns the render function"]
```

## The data

- 48 combinations of layout props. The tree has 500 styled elements: row `r` takes
  `combinations[(r + shift) % 48]`, cell `c` takes `TONES[(c + shift) % TONES.length]`.
- `createNested`: providers with `{ palette: { primary: '#d1531b' } }` and then
  `{ palette: { primary: '#123456' } }` around the themed elements; with the provider of `prepare`, three
  deep.
- The cache has prefix `b`, an in-memory sheet and no development checks.

## What it guarantees

- `prepare` awaits one render before it returns, so the operation measured is a render after the first.
- Each `createSetup()` has its own style object and cache.
- Nothing touches a browser global at module top level.

## Limits

- It renders to a string with the server renderer; the files that render into a DOM add their own setup
  in `dom.ts`.
- It needs `pnpm build` first.
