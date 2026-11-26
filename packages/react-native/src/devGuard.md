# devGuard.ts

## What it does

The development checks of the functions an app gives the React Native binding. `guardTheme(theme, label)`
gives the theme as a function named `label` gets it: in development wrapped by the core's
`createThemeGuard`, so that a write, a `delete` or an `Object.defineProperty` at any level throws a
`TypeError` naming the path and the label; otherwise the theme itself. `readStyleOwner(name)` is, in
development, the text that the error of a write into the frozen argument of a style function of the
component `name` starts with (what `callCheckedStyle` of the core is given), and undefined otherwise.

## Why it exists

The theme a function gets on React Native is one object for every render: the base theme, or the theme of
a provider above, converted once. A write into it from a style function, a function sheet, a function of
`keyframes` or a provider function changes it for every later render, with no error. The web engine guards
the same functions with its development checks (`referenceKeys.ts` and `createEngine.ts` of the core); this
binding has no engine, so it builds the guard once here, with the prefix of its own warnings, and turns it
on with the switch its warnings use (`isDevelopment` of `warnStyle.ts`: `NODE_ENV` is not `production`).

## The logic

```mermaid
flowchart TD
  gt["guardTheme(theme, label)"] --> dev{"isDevelopment()?"}
  dev -->|yes| wrapped["the core guard's wrapper: a write at any level throws, naming the path and the label"]
  dev -->|no| itself["theme itself"]
  owner["readStyleOwner(name)"] --> devOwner{"isDevelopment()?"}
  devOwner -->|yes| text["'@umber-style/react-native: A style function of \"name\"'"]
  devOwner -->|no| none["undefined: the binding calls the style functions directly"]
```

Who calls it: `styled.ts` (the theme in the argument of the style functions, and the owner, read once when
the component is made), `createStyle.ts` (a function sheet, label `StyleSheet`), `ThemeValue.tsx` (a
provider function, through `resolveThemeInput` of the core, label `ThemeProvider`) and `animatedDriver.ts`
(steps of `keyframes` written as a function, label `keyframes <name>`).

## The data

One guard for the binding: its wrappers are kept for each theme object and label while the object lives,
so the same part read by the same function is the same object in every render. A message, copied from
`devGuard.test.tsx`:

```
@umber-style/react-native: theme.space.3 is set by a function of "Card". The theme is one object, ...
```

## What it guarantees

- In production nothing is wrapped and nothing is frozen: `guardTheme` returns its argument.
- In development a function never changes the theme through what it was given.

## Decisions

- The switch is the binding's own (`NODE_ENV` is not `production`), as for its warnings, so a test runner
  that sets `NODE_ENV` to `test` runs with the checks.
- The label of a style function is the name its warnings use (the `name` option, else the component's).

## Limits

- `useTheme()` gives the theme itself, not guarded.
- What `createThemeGuard` does not see is not seen here either (`referenceKeys.md` of the core: a part
  copied out first, a write into a function, a `Date` or a `Map`).
