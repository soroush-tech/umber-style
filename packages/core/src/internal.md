# internal.ts

## What it does

The entry `@umber-style/core/internal`. It re-exports the helpers that a binding needs from the engine
and an app never does: `createThemeGuard` (with its type `ThemeGuard`) from `referenceKeys.ts`,
`callCheckedStyle` from `styleBase.ts`, and `readPageNonce` from `documentNonce.ts`. The React Native
binding uses the first two, for its development checks (`devGuard.ts`, `styled.ts`); the React binding
uses `readPageNonce` (`NonceStyles.tsx`), so that the nonce it writes the head with and the nonce the
cache gives its own elements are read by one definition.

## Why it exists

These names were in the main entry, which is the public surface of the package and is listed name by
name in `docs/plain-javascript.md`. Helpers for one binding do not belong in what an app reads. A second
entry keeps them importable across packages without presenting them as API.

## What it does not promise

Nothing between releases: a name here may change shape or go in any version, a patch included. The
umbrella `umber-style` does not re-export this entry, and `index.ts` does not export these names.

## One copy

The build has two entries over one set of modules (`tsdown.config.ts`), so the bundler puts the shared
modules in a common chunk and both entries import it: no module state is duplicated.

## The logic

```mermaid
flowchart LR
  guardSource["referenceKeys.ts: createThemeGuard, ThemeGuard"] --> entry["internal.ts"]
  callSource["styleBase.ts: callCheckedStyle"] --> entry
  nonceSource["documentNonce.ts: readPageNonce"] --> entry
  entry --> native["react-native: devGuard.ts, styled.ts"]
  entry --> react["react: NonceStyles.tsx"]
  entry -. "not re-exported" .-> umbrella["umber-style"]
```
