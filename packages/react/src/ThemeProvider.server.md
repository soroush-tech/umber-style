# ThemeProvider.server.ts

Build: server (components build: no hook, no context).

## What it does

`createThemeProvider(engine, parts)` makes the `ThemeProvider` for server components. It resolves the theme
it was given (a function is called with the base theme), turns it into plain data, computes the text and
names of the rules for both outcomes (nested, outermost), and renders `ProviderScope`, a client component,
with that data and the children. The first provider of a request also renders the stamp of the cache options.

## Why it exists

A server component has no context, and a server render of part of the page does not render the providers of
the layouts above it, so the server cannot tell whether a provider is nested. It sends data for either
answer and lets `ProviderScope` choose. `createStyle.server.ts` is the importer; it supplies `readFirstSlot`
(a per-request slot from `serverContext.ts`) and `readBaseTheme`.

## The logic

```mermaid
flowchart TD
  props["theme, isRoot, children"] --> resolve["resolveThemeInput(theme, base theme, engine.guardTheme): a function gets the base theme, shared by every request, guarded with the checks"]
  resolve --> slot["readFirstSlot()"]
  slot --> first{"slot.isSet?"}
  first -->|no| mark["isFirst: set slot to given, add stamp"]
  first -->|yes| later["not first, no stamp"]
  mark --> plain["toPlainTheme(given), warn once in development if members dropped"]
  later --> plain
  plain --> root{"isRoot?"}
  root -->|yes| rootOut["sendStyles: the style of the theme classes the app made; ProviderScope with no theme data"]
  root -->|no| describe["readDescription: describe(given, props, isFirst)"]
  describe --> scope["ProviderScope with prefix, plain theme, ScopeTheme"]
  rootOut --> frag["Fragment: stamp, styles, scope"]
  scope --> frag
```

`describe` reads the theme text (declarations, names, properties), the class id and root id from hashes, whether
the given theme declares every name of the base theme (`isWhole`), and, only for the first provider of a
request and a partial theme, the base theme as plain data (`readBase`, one object for each base theme).

## The data

- `ServerProviderParts<T>`: `readFirstSlot()`, `readBaseTheme()`, `readNonce()` and `sendStyles`, which makes the
  style of a root provider (`createStyleSender`, `inlineStyles.server.ts`).
- `ScopeTheme` (defined in `ProviderScope.tsx`): the data sent to the browser part, with the `nonce` of the
  engine's cache when it has one (left out otherwise, so that a payload holds nothing for it).
- A cache of descriptions: `WeakMap` from a theme object to a `Map` keyed by `colorScheme|className|as|isFirst`,
  each entry kept while the engine's base theme is the same object.

## What it guarantees

- It never gives the engine a base theme; that comes from `createStyle(theme)` or `configure({ theme })`.
- Only the first provider of a request sends the stamp and the base theme.
- Members of the theme that cannot cross (function, symbol, class instance) are left out, with one warning
  for the life of the provider maker, in development.
- Everything it sends that it did not make goes through `toPlainTheme`: the given theme, the base theme of
  `readBase` and the token options (`tokens`, one object for the engine). An object with hidden members
  (not enumerable, or under a symbol: helpers on `breakpoints`) is sent as a copy of its enumerable members,
  with no warning (#81), so React's development build has nothing to report about it.
- It calls no hook and imports nothing of the client build (`serverGuard.test.ts`).

## The nonce of a request

The style it sends (that of `isRoot`, and the one `ProviderScope` renders from `ScopeTheme`) carries the
nonce of the request, `readNonce()` of `createStyle.server.ts`: the cache's, or what the source registered
with `setNonceSource` gave this request. `ScopeTheme` is kept for each theme and set of props
(`readDescription`) with the nonce of the cache. Outside inline mode the request has no nonce (the
cache has none either), so the description kept is sent as it is. In inline mode (a request with a nonce,
from a source or the cache, `isInlineMode`) the request gets a copy with its own nonce and `isInline` (`withThemeNonce`), so the
description kept is never one request's, and `ProviderScope` gives its texts to `NonceStyles` instead of
rendering `<style href precedence>` elements; a root provider sends its texts with `sendStyles`, which
makes a `NonceStyles` too. While the source has not answered, the provider returns a Promise of its
elements, which a render of server components awaits; its type stays that of the client build.

```mermaid
flowchart LR
  provider["ThemeProvider(props)"] --> describe["readDescription: ScopeTheme with the nonce of the cache"]
  describe --> nonce{"readNonce(): inline mode for this request?"}
  nonce -->|no| same["that ScopeTheme: the nonce of the cache"]
  nonce -->|yes| copy["a copy with the nonce of the request and isInline"]
  nonce -->|"not known yet"| wait["a Promise of the elements"]
```

## Decisions

- The base theme goes under a partial theme only from the first provider of a request: a later one is below
  or beside it, not the outermost (comment in `describe`).
- With `isRoot` it sends the style of the theme classes the app already made with `themeClass`, and makes no rule.

## Limits

- A theme with a member that is not plain loses it for client components below; they read the value of the
  theme above (the warning text says so). A hidden member is lost the same way, without a warning: the
  browser takes the hidden members of the base theme of the client build where the raw values are the same
  (`crossedTheme.md`).
