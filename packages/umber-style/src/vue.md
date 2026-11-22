# vue.ts

## What it does

Re-exports everything of `@umber-style/vue` (`export * from '@umber-style/vue'`). It is the file of the
subpath `umber-style/vue`.

## Why it exists

The umbrella gives each binding as a subpath, so one install name serves every platform. Vue has no
platform switch: one file, one export entry.

## The logic

```mermaid
flowchart LR
  pkg["@umber-style/vue"] --> file["vue.ts"]
  file --> sub["umber-style/vue"]
```

## What it guarantees

- The names are those of the Vue binding, with the same identity (test "each binding exposes createStyle
  and the default style").
- No code of its own.
