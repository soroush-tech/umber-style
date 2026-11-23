# index.ts

## What it does

Exports `styled` of `@umber-style/react` as the default export of `@umber-style/styled`, and by the name
`styled` too, and re-exports the
types a styled component's code names (`CreateStyled`, `StyledComponent`, `StyledOptions`, `StyleProp`,
`Theme`, `CSSObject`, `Interpolation`, and the others in the file). It holds no code of its own.

## Why it exists

Code that imports `styled` as a default export (`import styled from '...'`) needs a module that has one.
The React binding exports `styled` by name only. This package is that legacy entry, so such code moves to
UmberStyle by changing its import path. Everything is the React binding's: no copy, no second engine.

## The logic

```mermaid
flowchart LR
  react["@umber-style/react: styled and the types"] --> entry["this file"]
  entry --> def["default export: styled"]
  entry --> named["named export styled: the same function"]
  entry --> types["the type names apps import"]
  cond["react-server condition at resolution"] --> react
```

The default export is the very function `styled` of the React binding (the test "is the styled of the
default style of the React binding, with its types and shorthands"). `configure` of the binding sets its
engine, and a server component gets the server build because the `react-server` condition is applied when
`@umber-style/react` is resolved (`index.server.test.tsx`: "is the styled of the server build").

## What it guarantees

- Same function, same tag shorthands as own members (`styled.div`), same behaviour as the binding's.
- The named export `styled` is the default export, with the same type (the test "is the named export
  too, with the same type").
- No module-level state of its own, no browser global.
- The types are the binding's, so a component typed through this entry is typed the same way.

## Decisions

- It re-exports instead of wrapping, so the server build and `configure` work without this package knowing
  about either.
- The type list is explicit, not `export *`, so the package exposes only the names apps import.
- The function is also exported by name for a library that is an ES module package and ships a CommonJS
  build. Its bundler compiles `import styled from '@umber-style/styled'` for CommonJS as Node's interop
  does, where the default is the whole `module.exports` (`{ __esModule: true, default, styled }`), not the
  function, so the library throws `is not a function`; an import by name gets the function. The shape of
  the CommonJS file (`cjsDefault: false` in `tsdown.config.ts`) was left as it is: making the function
  `module.exports` would change what every existing `require` of the package gets.
  `scripts/smoke-packed.mjs` runs that interop on the packed tarball.

## Limits

- There is no other value: the package has one function, as the default export and as `styled`
  (`exports` has only `.`).
