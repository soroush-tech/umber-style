# index.ts

## What it does

Re-exports everything of `@umber-style/core` (`export * from '@umber-style/core'`). It is the root entry
of the `umber-style` package (`exports["."]`).

## Why it exists

The umbrella holds no logic: it gives one install name for the engine and the bindings. The root is the
engine; each binding is a subpath (`umber-style/react`, `umber-style/react-native`, `umber-style/vue`). The
other files of `src/` only re-export too. Its tests (`index.test.ts`) prove that one source runs on every
binding.

## The logic

```mermaid
flowchart LR
  core["@umber-style/core"] --> idx["index.ts"]
  idx --> root["umber-style"]
```

## What it guarantees

- The root exposes exactly the public names of the core, with the same identity: `createCache` from here
  is the one of `@umber-style/core` (test "the root is the engine").
- No code runs here.

## Limits

- It re-exports the core only; a binding is reached through its subpath.
