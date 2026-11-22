# devChecks.ts

## What it does

The development-time warning machinery. `isDevelopment()` and `isProduction()` read
`process.env.NODE_ENV`, `createWarner(prefix)` makes a function that warns once for each key, and
`createDevChecker(prefix, delay, page, readLabel)` makes the function that schedules a check of a page after
the rules have stopped arriving. `warnRenamedOption(prefix, options)` warns, in development, about an
options object that still has `hasRuleText`, the name of `speedy` before 0.3.0.

## Why it exists

The engine writes rules into a page while it renders, and some mistakes only show in the result: a class
used in the markup that has no rule in the sheet (`findMissingStyles`), and a declaration the browser does
not support (`findUnsupportedDeclarations`). Checking at each insertion would be noisy and slow, so the
checker waits for a burst to end, runs once, and never warns twice about one problem. The checks are for
development only. `cache.ts` builds the checker and the warner, `createEngine.ts` builds its own warner,
`sharedState.ts` and the React server files read `isDevelopment`, and `index.ts` exports `isDevelopment`.

## The logic

```mermaid
flowchart TD
  call["checker(rules?)"] --> sup{"browser can answer CSS.supports?"}
  sup -->|yes| keep["keep the rules written since the last run"]
  sup -->|no| skip["rules are not kept"]
  keep --> timer
  skip --> timer{"a timer is waiting?"}
  timer -->|yes| nothing["do nothing, the run is already scheduled"]
  timer -->|no| set["setTimeout(run, delay)"]
  set --> run["run"]
  run --> missing["findMissingStyles(page, prefix): warn each problem by its key"]
  missing --> ask{"supports available?"}
  ask -->|no| done["end"]
  ask -->|yes| unsup["findUnsupportedDeclarations(kept rules): warn each by 'declaration:message'"]
  unsup --> done
  warn["warn(key, message)"] --> seen{"key seen before?"}
  seen -->|yes| drop["nothing"]
  seen -->|no| log["console.warn('[prefix] message')"]
```

The timer is not restarted by later calls: `timer ??=` means the first call of a burst sets the delay
(250 ms by default), and the run takes every rule written until then.

`warnRenamedOption` warns once for each options object (a `WeakSet` of the objects warned about), so an
object that one function hands to another as it is gets one warning. Its message says what to write for the
value given (`hasRuleText: false` is `speedy: true`) and that the value is not read. Nothing is warned about
outside development, nor for `hasRuleText: undefined`.

```mermaid
flowchart TD
  renamed["warnRenamedOption(prefix, options)"] --> given{"hasRuleText given, object not warned, development?"}
  given -->|no| quiet["nothing"]
  given -->|yes| once["add the object to the set; console.warn with what to write instead"]
```

## What it guarantees

- A warning is written once for each key for the life of the warner, and always starts with `[prefix] `.
- Rules are kept only when `CSS.supports` can be asked; otherwise nothing accumulates.
- `isDevelopment()` is false and `isProduction()` is true where `process` does not exist.
- At module top level nothing touches a browser global (`document` appears only as the default of a
  parameter, read when the checker is made).

## Decisions

- Missing-style problems are deduplicated by `problem.key`; unsupported declarations by their message with
  a `declaration:` prefix, so the two kinds cannot collide.
- `process` is declared locally, so the core needs no type package for it (the comment in the code).
- The unknown-environment answer differs by question: not development, and production.

## Limits

- The run takes the page at the time the checker was made, not at the time of the run.
- Where the browser cannot be asked (no `CSS.supports`, or jsdom) unsupported declarations are not checked.
