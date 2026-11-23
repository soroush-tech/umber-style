# index.server.ts

Build: server (the entry under the `react-server` condition: no hook, no context).

## What it does

It is the public entry of `@umber-style/react` for server components. It makes the server default style once
and exports its members: `configure`, `getEngine`, `styled`, `StyleSheet`, `useStyle`, `useStyleValue`, `useTheme`,
`readTheme`, `ThemeProvider`, `apply`, `css`, `themeClass`, `when`, `whenScheme`, `keyframes`,
`globalStyles`, `Global`. It re-exports the core's math helpers, `createStyle.server` and `defaultStyle.server`,
and the types.

## Why it exists

A server component must not import anything that calls a hook or makes a context. This entry reaches only the
files of the server build, so the bundle of server components holds none of the client build. Compared with
`index.ts`, it has `readTheme` and lacks `ThemeScope`, `useThemeClass`, `ThemeContext`, `CacheProvider` and
`useMediaQuery`.

## The logic

```mermaid
flowchart LR
  shared["readSharedState 'react.server-default-style@1'"] --> make["createDefaultStyle of defaultStyle.server"]
  make --> names["destructured named exports"]
  core["core: add, alpha, at, divide, multiply, negate, state, subtract"] --> out["public API"]
  names --> out
  cs["createStyle.server.ts, defaultStyle.server.ts, types.ts"] --> out
```

## What it guarantees

- The files it reaches are exactly `Global.server.ts`, `ThemeProvider.server.ts`, `createStyle.server.ts`,
  `defaultStyle.server.ts`, `index.server.ts`, `plainTheme.ts`, `serverContext.ts`, `styleElements.ts`,
  `styled.server.ts`, `styledParts.ts` and `types.ts`; it reaches two client components only by reference,
  `GlobalRelease.ts` and `ProviderScope.tsx` (`serverGuard.test.ts`).
- It calls no hook, makes no context and imports nothing of the client build.

## Decisions

- `readTheme` is the same function as `useTheme`: a server component calls it without the name of a hook.
- The shared-state key is not the client's, so one program may hold both builds.

## Limits

- No `CacheProvider` here: the server build has no context to carry a cache.
