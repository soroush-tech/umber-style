# createStyle.server.ts

Build: server (components build: no hook, no context). The client counterpart is `createStyle.ts`.

## What it does

`bindEngine(engine, cache?)` assembles the styling for server components over one engine: `styled`,
`StyleSheet`, `useStyle`, `useStyleValue` (`useStyleValue.server.ts`: the first number, a setter that warns), `apply`, `css`, `ThemeProvider`, `useTheme` (also exported as `readTheme`),
`themeClass`, `when`, `whenScheme`, `keyframes`, `globalStyles` and `Global`. `createStyle(theme, options)`
makes the engine, gives it the theme as base theme, and binds it. There is no `ThemeScope`,
`useThemeClass` or `ThemeContext` in this build.

## Why it exists

A server component reads no context, so the theme must come from somewhere else: the base theme the app
gave, else the theme of the first provider of the request. This file builds that reading (`readViewTheme`)
and passes it to the server `styled` and `Global`, and passes the request slot to the server `ThemeProvider`.
It also makes the reader of the nonce of a request (`createNonceReader`, `serverContext.ts`), with the
nonce of the cache as its fallback, and gives it to all three, so that every style element of a request
carries the nonce that a source registered with `setNonceSource` gave it.
`defaultStyle.server.ts` and `index.server.ts` use it.

## The logic

```mermaid
flowchart TD
  engine["engine, optional cache function"] --> slot["createRequestSlot: first theme of the request"]
  slot --> viewTheme["readViewTheme"]
  viewTheme --> base{"engine.givenTheme?"}
  base -->|yes| useBase["base theme"]
  base -->|no| first{"slot.current set?"}
  first -->|yes| useFirst["theme of the first provider"]
  first -->|no| empty["empty theme"]
  useBase --> parts["createStyled, createGlobal, useStyle"]
  useFirst --> parts
  empty --> parts
  slot --> provider["createThemeProvider(engine, readFirstSlot, readBaseTheme, readNonce)"]
  engine --> nonce["createNonceReader: the nonce of the cache, or of the source, once a request"]
  nonce --> parts
  nonce --> provider
  engine --> useTheme["useTheme: warn once in development if no base theme, return base theme"]
```

## The data

The request slot is `{ current: DeepPartial<T> | undefined, isSet }`, made by `React.cache` in
`serverContext.ts`.

## What it guarantees

- `useTheme()` returns the base theme, the same in every render; it never reads a provider.
- With no base theme it returns an empty object, and warns once in development.
- An object sheet works with no theme; a themed sheet resolves against `engine.createThemeView(readViewTheme())`.
- `apply` and `css` use the engine's own cache; there is no `CacheProvider` in this build.
- No hook is called; `serverGuard.test.ts` checks it for the files of this build.

## Decisions

- Tokens are references in the view either way, so only the shape of the theme is needed: the first provider's
  theme gives it when the app has no base theme (comment on `readViewTheme`).
- `cache` is a parameter so a test can give a function with the contract of `React.cache`.

## Limits

- What needs the values of the nearest provider is a client component, whose `useTheme()` reads them.
