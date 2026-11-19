# Typed styles

After this page you can tell what the compiler catches in a style on each platform, what it lets through, and how to get past it when you must.

Each entry checks the keys of a style in an object literal, for its own platform:

| Entry                                              | Keys allowed                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@umber-style/react`, `@umber-style/vue`, the core | every CSS property, nested selectors and at-rules, custom properties (`--x`) and `label` |
| `@umber-style/react-native`                        | the platform's view, text and image style keys; nothing nested                           |
| `umber-style/react`                                | only the keys that both of them have, with the values that both accept                   |

`umber-style/vue` and `umber-style` follow the web types. `umber-style/react` is the entry for code that runs on the web and on React Native: use `@umber-style/react` for code that only runs on the web, or you will get the stricter shared types.

## The web

`WebStyleObject` is the type of a style on the web: every CSS property with its values (a number where CSS takes a length, a list for fallbacks), nested styles under a selector or an at-rule, custom properties (`--name`) and `label`. `engine.css`, `createSheet`, `createStyler`, and the `styled`, `StyleSheet.create` and `style` of the web bindings take it. It comes from `@umber-style/core` (and `umber-style`); the web bindings do not re-export it.

The typings of the CSS properties come from the standard `csstype` package. It is a `dependency` of the core and is only imported as a type, so the core has no run-time dependency on it. The declarations the core publishes refer to it, and a consumer without it would see every property as `any`.

```ts
import { createStyle } from '@umber-style/react'
import type { StyleObject, WebStyleObject } from '@umber-style/core'

const { styled } = createStyle({ palette: { primary: '#1b5fd1' } })

styled('div')({
  display: 'grid',
  padding: 8,
  '&:hover': { opacity: 0.8 },
  '@media (min-width: 40em)': { padding: 16 },
  '--accent': '#1b5fd1',
})

// @ts-expect-error a key that is not a CSS property
styled('div')({ backgroudColor: 'red' })

// @ts-expect-error a value that is not a keyword of display
styled('div')({ display: 'gird' })

// Not caught: a misspelt key in an object that a variable holds.
const loose = { color: 'red', backgroudColor: 'red' }
styled('div')(loose)

// Not caught: the object that a style function returns, when it has no return type.
styled('div')(() => ({ color: 'red', backgroudColor: 'red' }))

// Caught again with a return type, or satisfies.
// @ts-expect-error a misspelt key
styled('div')((): WebStyleObject => ({ backgroudColor: 'red' }))
// @ts-expect-error a misspelt key
styled('div')(() => ({ backgroudColor: 'red' }) satisfies WebStyleObject)

// Not caught: a value that CSS cannot list is any string.
styled('div')({ color: 'not-a-colour', width: '12 parsecs' })
```

What is checked:

- In an object literal, a key that is not a property, a selector or an at-rule (`backgroudColor`).
- A wrong value where the property's typing is a closed set of keywords: `display: 'gird'`, `position: 'abslute'`, `flexDirection: 'rows'` and `textAlign: 'midle'` are errors. `display` is written out by the engine, because `csstype` lets any string through for it; the others come from `csstype`. A property whose typing admits any string is not checked: `cursor: 'ponter'` compiles.
- A nested style under a selector (a key with `&`, or one that starts with `:`) or an at-rule (a key that starts with `@`) is itself checked as a style.

What is not checked:

- A misspelt key in an object that a variable holds, or in the object that a style function returns without a return type. Give the function a return type of `WebStyleObject`, or end the literal with `satisfies WebStyleObject`.
- A value that CSS cannot list (a colour, a length with a unit): it is any string.
- Whether a selector is valid CSS.

A `style` prop of a styled component is checked like a style.

### Keys built at run time

A key made from a variable, such as a media query from a breakpoint, has the type `string`, which matches none of the key patterns of `WebStyleObject`, and TypeScript rejects the object. These forms were compiled and are accepted:

```ts
import type { WebStyleObject } from '@umber-style/core'

// 1. Type the dynamic part, then spread it. The rest of the object stays checked.
styled('div')(({ theme }) => {
  const wide: Record<`@media ${string}`, WebStyleObject> = {
    [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 },
  }
  return { gap: 8, ...wide }
})

// 2. Cast the whole result, when the object also has an ordinary property.
styled('div')(
  ({ theme }) =>
    ({ gap: 8, [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 } }) as WebStyleObject
)

// 3. Go through unknown, when the dynamic key is the only one.
styled('div')(
  ({ theme }) =>
    ({ [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 } }) as unknown as WebStyleObject
)
```

The key of `when()` and `whenScheme()` is a computed key too, and the web types reject it in an object literal. Put the conditions in a variable and spread it: see [Theme conditions](theme-conditions.md).

A key that starts with `:` and has no `&` (`':hover'`) is accepted by the types but written as a descendant selector. Use `'&:hover'`.

### The escape hatch

`StyleObject`, with any key, is the loose type that the serializer works on. To use a key that the types do not know (a property that is too new for `csstype`), cast the style to the type of the platform:

```ts
const unknownKey = { containerType: 'inline-size', somethingNew: 'x' } as StyleObject
styled('div')(unknownKey as WebStyleObject)
```

## React Native

`NativeStyleObject` is the type of a style on React Native: the keys of the platform's view, text and image styles, each with the value type of the platform, and nothing nested. `styled`, `StyleSheet.create`, the `style` prop and `apply` take it. A selector, an at-rule, a custom property, `label`, `display: 'grid'` or a misspelt key is an error in an object literal.

```ts
const Card = styled(View)({
  padding: 8,
  elevation: 2,
  transform: [{ rotate: '45deg' }],
})

// @ts-expect-error a nested selector does not exist on React Native
styled(View)({ '&:hover': { opacity: 0.8 } })
// @ts-expect-error React Native has no grid
styled(View)({ display: 'grid' })
// @ts-expect-error a misspelt property next to valid ones
styled(View)({ padding: 8, paddng: 8 })
```

(These are the cases of `packages/react-native/src/nativeStyle.test.tsx`, which `pnpm typecheck` compiles.)

The types come from the platform's own `ViewStyle`, `TextStyle` and `ImageStyle`, so `react-native` is a development dependency of the binding and a peer of your app. What the types cannot reject is warned about in development, once for each message:

- a shorthand with several values (`padding: '10px 20px'`, `margin: '0 auto'`);
- a value with a CSS unit (`width: '12px'`).

Nothing is warned in production. The `web`-only keys (`label`, selectors, at-rules, custom properties) are dropped when a style is turned into a native style.

## Web and mobile: `umber-style/react`

Under the `react-native` export condition `umber-style/react` is the React Native binding at run time. For the compiler it is always the same set of types, so one source type-checks the same whichever platform builds it. The set is the keys both platforms have, each with the values both accept:

- `display: 'grid'`, a nested selector, `elevation`, `float` or `label` at the top level of a shared style is an error.
- `display: 'flex'`, `'none'` and `'contents'` are accepted; `display: 'block'` and `'inline-block'` are errors.
- A number, a percentage and `'auto'` are accepted as lengths; `'10px'` compiles, because the platform types a dimension as `number | string`. React Native warns about it in development.

A shared style has two parts for one platform each, so that a platform-only thing stays visible in the shared code:

```ts
const Box = styled(Host)({
  padding: 8,
  web: { '&:hover': { opacity: 0.8 }, display: 'grid' },
  native: { elevation: 2, transform: [{ rotate: '45deg' }] },
})
```

`web` takes a web style and `native` takes a native style, so a native-only key inside `web` is an error, and the other way round. The types are `SharedStyleObject`, `WebStyleObject` and `NativeStyleObject`. `SharedStyleObject` is from `umber-style/react`; the other two are from `@umber-style/core` and `@umber-style/react-native`.

A tag name such as `'div'` type-checks in shared code and throws on React Native, so give `styled` a component there. See [Style sheets and the style prop](style-sheets.md) for a pattern that does this.

To use a key that a type does not know, cast the style to the type of the platform: `style as WebStyleObject`, or `style as NativeStyleObject`.

The cases above are those of `packages/umber-style/src/sharedTypes.test.tsx`, which `pnpm typecheck` compiles twice, with and without the `react-native` export condition.

## Vue

Vue uses the web types for styles. A styled component's props are not typed: `styled` returns a component that takes any attributes. A function style receives the attributes as a `Record<string, unknown>`.

## Server components

Under the `react-server` condition `@umber-style/react` has no `useTheme` and has `readTheme`. The compiler only sees that if its configuration includes the `react-server` custom condition (`customConditions: ["react-server"]` in `compilerOptions`). Without it the types are those of the client build: `readTheme` is reported as missing, and `useTheme` type-checks and does not exist at run time. See [Server rendering](server-rendering.md).

## Limits

- The values of colours and lengths are not checked, on any platform.
- Computed keys need one of the forms above on the web.
- The shared types are an intersection: a valid web style (`display: 'block'`) is a type error in shared code and goes in `web`.
- Types do not know which props of a host element `shouldForwardProp` forwards.
- The examples were compiled with TypeScript 7.0.2. Other versions were not tried.
