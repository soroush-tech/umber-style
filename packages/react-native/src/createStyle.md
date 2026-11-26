# createStyle.ts

## What it does

`bindHolder(holder, context?, options?)` builds the whole React Native styling of one theme shape: `styled`,
`StyleSheet`, `useStyle`, `apply`, `css`, `ThemeProvider`, `useTheme`, `when`, `whenScheme` and the web
members that do nothing here. `createStyle(theme, options)` is `bindHolder` over a holder of that theme. With
the `animated` option, `bindHolder` binds it once (`animated.bind`) to its `remBase` and its base theme, and
gives the `Motion` it makes to `styled`, to the sheets and to `css()`.

## Why it exists

The default style (`defaultStyle.ts`) and an app's own style (`createStyle`) must be the same code over
different holders of the base theme. This file wires the pieces (`ThemeValue.tsx`, `styled.ts`,
`toNativeStyle.ts`, `windowState.ts`, `nativeTheme.ts`) into the `NativeStyle<T>` interface of `types.ts`.
It also owns sheets: registering a sheet's entries with the platform and resolving them for conditions and
the window. Importers: `defaultStyle.ts` (`bindHolder`) and `index.ts` (`createStyle`).

## The logic

```mermaid
flowchart TD
  bind["bindHolder"] --> warn["warn about options the platform ignores"]
  bind --> tv["createThemeValue with a converter over lengthKeys and remBase"]
  bind --> motionQ{"animated given?"}
  motionQ -->|"yes"| motionNode["motion = animated.bind(remBase, base theme), in the settings of every style"]
  motionQ -->|"no"| noMotion["motion undefined: animation keys dropped as before"]
  create["StyleSheet.create(styles)"] --> fn{"a function of the theme?"}
  fn -->|"no: object sheet"| lazy["lazy record: registered with the platform on first read"]
  fn -->|"yes"| themed["themed sheet: prepare and resolve"]
  themed --> prep["prepare(theme): register once for each theme object"]
  use["useStyle(sheet)"] --> ctx["read theme and condition first, always"]
  ctx --> isT{"themed sheet?"}
  isT -->|"no"| same["return the sheet itself"]
  isT -->|"yes"| key["useMediaKey over the sheet's queries"]
  key --> res["resolveEntries"]
  res --> cond{"conditional entries?"}
  cond -->|"no"| win["window entries: registered once for each set of matching queries"]
  cond -->|"yes"| fresh["conditional entries: resolved on each render, not registered"]
```

## The data

`RegisteredSheet` holds `entries` (as registered with the platform StyleSheet), `source` (the styles before
conversion), `keys` (a `StyleKeys` for each entry), `isConditional`, `queries`, `hasScheme` and a lazy
`byWindow` map from a window key to entries. The holder is a `ThemeHolder<T>` of `ThemeValue.tsx`,
`{ baseTheme }`: `createStyle` makes one with its theme, `defaultStyle.ts` one that `configure` fills.
`SheetSettings` is `NativeSettings` without the name, `{ remBase, motion }`: the name of each entry
(`sheet entry "key"`, `css()`) is added to it where the entry is turned into a native style.

## What it guarantees

- A function sheet is registered once for each native theme object (`WeakMap`), not on each render.
- An object sheet registers on first read of a key, once, with no theme and no condition; it is its own
  registered styles and `useStyle` returns it unchanged.
- The hooks of a component never change between renders: the contexts and the window key are read first,
  for every sheet.
- Entries that depend only on the window are registered once for each set of matching queries; entries with
  a `when()` or `whenScheme()` key are resolved on each render and never registered.
- `css()` merges its styles in order, last key wins, drops falsy values and flattens lists; a function or a
  non-object throws a `TypeError`.
- `Global`, `ThemeScope`, `useThemeClass`, `themeClass` do nothing (`Global` renders `null`, `ThemeScope` its
  children, `themeClass` returns `''`, `useThemeClass` `undefined`); `keyframes` and `globalStyles` come from
  the core so one source runs on both.
- `apply(...entries)` returns `{ style: [...] }` with falsy entries removed.
- With `animated`, a sheet entry and `css()` keep their animation and transition keys, translated: the
  entry can be given to a component that the library animates. Steps that are a function of the theme are
  resolved against the base theme as it was given (the empty theme when there is none).

## Decisions

- Registered styles go through the platform's `StyleSheet.create` after `toNativeStyle` removed web-only keys.
- Warnings name the entry (`sheet entry "key"`) or `css()`.
- The scheme is watched only when a sheet has a `whenScheme()` key and no provider gives a scheme
  (`shouldWatchScheme`).
- `resolve(theme, condition)` of a sheet reads the key with `hasScheme` false; it is for direct calls, and
  `useStyle` is the path that watches the scheme.

## Limits

- Only `remBase`, `lengthKeys` and `animated` of the options are used; the rest warn in development.
- Steps that are a function of the theme follow the base theme, not the theme of a provider.
- A function sheet is called with the theme guarded in development (`guardTheme`, label `StyleSheet`); its
  registered entries stay kept by the theme itself.
- A sheet entry is not a component: `useStyle` does not watch reduced motion for it, and nothing wraps the
  component it is given to (see `styled.md`).
- A `state()` key in a sheet entry or in `css()` never applies here: an entry belongs to no component, so
  there is no state to match, and the part is dropped without a warning. `StyleKeys` of an entry carries its
  states, and nothing reads them. On the web the same entry is a class whose state rules the browser applies.
