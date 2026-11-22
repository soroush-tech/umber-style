# windowState.ts

## What it does

Reads the window and the system settings, and lets components subscribe to their changes. It gives
`readWindowState()`, `subscribeToWindow(listener)`, `readMediaKey(queries, hasScheme, remBase)`, the hook
`useMediaKey` (the same key in a component) and `useMediaMatch` (the engine of `useMediaQuery`).

## Why it exists

A style with media keys depends on the window, and a component must render again when the answer changes,
but not on every pixel of a resize. The file turns "which queries match now" into a short string key and
subscribes through `useSyncExternalStore`, so a component renders again only when the key changes.
`styled.ts` and `createStyle.ts` use the key to register one set of styles for each combination of matching
queries; `defaultStyle.ts` calls `useMediaMatch`; `index.ts` re-exports the `MediaQueryOptions` type.

## The logic

```mermaid
flowchart TD
  sub["first subscriber"] --> listen["listen once: Dimensions change, Appearance change, reduceMotionChanged"]
  sub --> ask["ask isReduceMotionEnabled once"]
  ask --> setrm["setReducedMotion"]
  listen --> notify["notify every listener"]
  setrm --> diff{"value changed?"}
  diff -->|"yes"| notify
  diff -->|"no"| stop["nothing"]
  last["last subscriber leaves"] --> rm["remove every platform subscription"]
  key["readMediaKey"] --> st["readWindowState"]
  st --> loop["for each query: 1 if it matches, else 0"]
  loop --> sch{"hasScheme?"}
  sch -->|"yes"| add["append colon and the system scheme"]
  sch -->|"no"| out["key string"]
  add --> out
  hook["useMediaKey"] --> need{"queries or scheme?"}
  need -->|"no"| none["subscribe to nothing, key is empty"]
  need -->|"yes"| uses["useSyncExternalStore with subscribeToWindow"]
```

## The data

The key is one character for each query (`'1'` or `'0'`), then `:` and the system scheme when `hasScheme`:
`'101'`, or `'10:dark'`. Module state: `isReducedMotion` (false until the platform answers), a `Set` of
listeners, and the list of platform subscriptions.

## What it guarantees

- The platform is listened to once for all subscribers, and the listeners are removed when the last one goes.
- Two renders with the same key resolve the same style.
- A component with no queries and no scheme subscribes to nothing and makes no key reader.
- Reduced motion is `false` until the platform answers (the comment says this is the platform's default).
- `useMediaMatch` of a query with a `problem` warns (development) and subscribes to nothing; its server
  snapshot is `options.defaultMatches ?? false`.

## Decisions

- A string key instead of the width: the component renders again only when the matching set changes.
- One shared subscription, not one per component.

## Limits

- Reduced motion cannot be known at the first render: the first answer arrives asynchronously, then a
  change renders the affected components again.
- The `.then` of `isReduceMotionEnabled` has no catch.
