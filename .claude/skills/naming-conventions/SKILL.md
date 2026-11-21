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

The public names that every binding shares (`styled`, `css`, `keyframes`, `globalStyles`, `alpha`,
`at`, `apply`) are API, kept the same in each binding (`AGENTS.md`); they are not renamed to fit
this rule.

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

Use `UPPER_SNAKE_CASE` for truly fixed, non-reassignable module-level values (`ROOT_SELECTOR`,
`HEX_PATTERN` in `@umber-style/core`). Mutable module-level variables stay camelCase.

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
- Single-letter or cryptic names (`val`, `tmp`, `x`) outside loop counters
- Adding a comment to explain what a name means - rename instead

If the arguments name a file, read it and apply these rules. Otherwise apply to the code being
discussed.
