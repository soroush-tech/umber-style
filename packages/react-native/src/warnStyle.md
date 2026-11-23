# warnStyle.ts

## What it does

Development warnings for what the types cannot reject: `warnAboutValues` (a style value that was not
converted and is wrong on React Native), `warnAboutDroppedKey` (a web-only key that is dropped by mistake),
`warnAboutQuery` (a `useMediaQuery` text the binding cannot evaluate), `warnAboutIgnoredOptions` (options
of `createStyle` or `configure` that are only for the web) and `warnAboutUnheldState` (a function style that
names `hovered` or `focused` in a component that keeps no such state).

## Why it exists

A shared source can carry values that mean something on the web and nothing on React Native: a shorthand
`'8px 16px'`, `calc(...)`, `currentColor`, `em` or `vh` lengths, selectors, at-rules. Dropping or passing
them silently hides the mistake. This file says what is wrong and what to write instead. `toNativeStyle.ts`
calls the first two, `windowState.ts` the third, `createStyle.ts` the fourth, `styled.ts` the fifth.

## The logic

```mermaid
flowchart TD
  call["a warn function"] --> dev{"development: process exists and not production?"}
  dev -->|"no"| quiet["nothing"]
  dev -->|"yes"| desc["describe the problem"]
  desc --> kind{"which function?"}
  kind -->|"values"| val["shorthand, calc, currentColor, or a CSS unit"]
  kind -->|"dropped key"| drop["label, condition and state keys and evaluated media: no problem"]
  kind -->|"unheld state"| held["the state, and the events that would keep it"]
  held --> has
  kind -->|"option names"| opt["names outside theme, remBase, lengthKeys"]
  val --> has{"a message?"}
  drop --> has
  opt --> has
  has -->|"no"| quiet
  has -->|"yes"| once{"text already warned?"}
  once -->|"yes"| quiet
  once -->|"no"| emit["console.warn with the package prefix"]
```

## The data

The set `warned` holds the full text of each message, with the component or sheet entry name in front when
known (`sheet entry "card": ...`, `css(): ...`). A dropped-key reason is one of: unsupported media part,
`React Native has no at-rules`, `no custom properties`, `animations do not run on React Native yet`,
`no selectors`.

## What it guarantees

- A message is printed once for each distinct text, for the life of the program.
- Nothing is printed outside development; `process` may not exist, and then nothing is printed.
- `label`, a condition key, a known `state()` key and a media query that is evaluated are not mistakes and
  are never warned about. A selector key such as `&:active` still gets `React Native has no selectors`, as
  before the state keys; a `@state` key with an unknown name gets `React Native has no at-rules`.
- A key that is a media query with an unsupported part is warned about, with the `problem` from
  `mediaQuery.ts`.
- It never throws and never changes a style.

## Decisions

- Only strings are checked, and only the units that are CSS and not native: `em` and the viewport units get
  their own message, the other CSS units a general one.
- The shorthand test accepts two to four values that are lengths or `auto`.
- Warning once (not on every render) is in the code; the reason is not recorded.

## Limits

- A number under a wrong key, or a string under an unknown key, is not checked.
- The set of printed messages is never emptied.
