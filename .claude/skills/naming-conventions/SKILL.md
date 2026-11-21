---
name: naming-conventions
description: JavaScript and TypeScript naming conventions - variables, booleans, functions, classes, components, constants, private members and unused parameters. Use when naming or reviewing identifiers in the .ts, .tsx, .js and .mjs files of this repository.
paths: '**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.mjs'
metadata:
  internal: true
---

# Naming Conventions

## Variables - camelCase

```ts
// Bad
const first_name = 'Robin'
const FIRSTNAME = 'Robin'
const val = 'Robin'

// Good
const firstName = 'Robin'
```

## Booleans - is / are / has prefix

```ts
// Bad
const visible = true
const equal = false
const encryption = true

// Good
const isVisible = true
const areEqual = false
const hasEncryption = true
```

The same holds for boolean options and fields: the engine's options and arguments are named
`hasDevChecks`, `hasValueRepair`, `isRendered`, and a type guard is `isAlphaColor`.

A name that mirrors a platform term, or an interface kept for compatibility, keeps that name:
`compat` on the cache object, `defaultMatches` (it mirrors the browser's `matches`), and a prop or
option that carries a CSS or platform word (`wrap`, `reducedMotion`, `colorScheme`). Every other
boolean takes the prefix.

## Functions & Methods - camelCase + verb prefix

```ts
// Bad
function name(firstName, lastName) { ... }

// Good
function getName(firstName, lastName) { ... }
```

Common verbs: `get`, `set`, `create`, `read`, `find`, `update`, `delete`, `calculate`, `handle`,
`is`, `has`, and `use` for a hook.

Function names describe **what the function does**, not what it blocks or how it works internally.

```ts
// Bad - describes what it blocks, not what it does
const blockSize = (prop: string) => prop !== 'size'

// Bad - describes the implementation detail
const isNotSize = (prop: string) => prop !== 'size'

// Good - describes the function's purpose in its context
const shouldForwardInputProps = (prop: string) => prop !== 'size'
```

The public API of the engine and its bindings is exempt: a public name that is established is not
renamed to fit this rule. That covers the names every binding shares (`styled`, `css`, `keyframes`,
`globalStyles`, `alpha`, `at`, `apply`; `AGENTS.md`) and the exports and methods that users call by
a noun or a short name (`themeClass`, `themeId`, `scopeClass`, `when`, `whenScheme`, `refs`, `cssIn`,
`cssWith`, `cssHeld`, `cx`, and the like). An internal helper, exported from its file or not,
follows the rule.

## Classes - PascalCase

```ts
// Bad
class softwareDeveloper { ... }

// Good
class SoftwareDeveloper { ... }
```

## Components - PascalCase

```tsx
// Bad
function userProfile(user) {
  return <div>...</div>
}

// Good
function UserProfile(user) {
  return <div>...</div>
}
```

Use descriptive, meaningful names. Don't append a redundant `Component` suffix - the JSX usage
already makes it a component.

```tsx
// Bad - camelCase start
function markdownComponent(props) { ... }

// Bad - redundant "Component" suffix
function MarkdownComponent(props) { ... }

// Good - PascalCase, concise
function Markdown(props) { ... }
```

## Constants - UPPER_SNAKE_CASE

```ts
// Bad
const secondsInDay = 86400

// Good
const SECONDS_IN_DAY = 86400
```

Use `UPPER_SNAKE_CASE` for the fixed values at module scope that are data: a primitive, a regular
expression, a list of keys, a lookup table (`ROOT_SELECTOR`, `HEX_PATTERN` in `@umber-style/core`,
a `Set` of property names, a map from a name to a value). A fixed object that is a thing with a
name of its own stays camelCase: a theme (`lightTheme`), a `keyframes` or `globalStyles` handle, a
sheet. Mutable module-level variables stay camelCase.

## Private - \_ prefix

```ts
// Good - signals internal use only (the statics of a styled component)
const statics = {
  _styles: styler.styles,
  _shouldForwardProp: shouldForward,
}
```

Unused parameters and unused destructured values also use the `_` prefix (`(_target, key) =>`,
`{ native: _native, ...rest }`): the lint config ignores unused names that start with `_` and
reports every other one.

## Avoid

- `snake_case` for variables or functions
- `kebab-case` in identifiers (`first-name` is a syntax error)
- Single-letter or cryptic names (`val`, `tmp`, `x`) outside loop counters, and `at` for a
  position in a string or a list (it is also the name of a public helper): `index`, `position`
- Adding a comment to explain what a name means - rename instead

If the arguments name a file, read it and apply these rules. Otherwise apply to the code being
discussed.
