# Typed styles

After this page you can tell what the compiler catches in a style on each platform, what it lets through, and how to get past it when you must; and you know the type names an app imports, where they live, and the two ways to type the theme.

Each entry checks the keys of a style in an object literal, for its own platform:

| Entry                                              | Keys allowed                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@umber-style/react`, `@umber-style/vue`, the core | every CSS property, nested selectors and at-rules, custom properties (`--x`) and `label` |
| `@umber-style/react-native`                        | the platform's view, text and image style keys; nothing nested                           |
| `umber-style/react`                                | only the keys that both of them have, with the values that both accept                   |

`umber-style/vue` and `umber-style` follow the web types. `umber-style/react` is the entry for code that runs on the web and on React Native: use `@umber-style/react` for code that only runs on the web, or you will get the stricter shared types.

## The web

`WebStyleObject` is the type of a style on the web: every CSS property with its values (a number where CSS takes a length, a list for fallbacks), nested styles under a selector or an at-rule, custom properties (`--name`) and `label`. `engine.css`, `createSheet`, `createStyler`, and the `styled`, `StyleSheet.create` and `style` of the web bindings take it. It comes from `@umber-style/core`. The web bindings re-export it as a type, with `WebProperties`, `WebNested`, `NestedKey`, `StyleObject`, `AlphaColor`, `SheetEntry`, `ThemeKey`, `SchemeKey` and `SchemeName`: `@umber-style/react` (both builds), `@umber-style/vue`, and every entry of `umber-style` but `umber-style/react-native`.

The typings of the CSS properties come from the standard `csstype` package. It is a `dependency` of the core and is only imported as a type, so the core has no run-time dependency on it. The declarations the core publishes refer to it, and a consumer without it would see every property as `any`.

```ts
import { createStyle, type StyleObject, type WebStyleObject } from '@umber-style/react'

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
- A key that starts with `:` (`':hover'`, `'::before'`) is the element itself, written as if it were `'&:hover'`: the rule is `.class:hover`. A key with no `&` that does not start with `:` (`'span'`, `'> li'`) is an error in an object literal, because it would be a descendant selector; the loose `StyleObject` writes it as one.

What is not checked:

- A misspelt key in an object that a variable holds, or in the object that a style function returns without a return type. Give the function a return type of `WebStyleObject`, or end the literal with `satisfies WebStyleObject`.
- A value that CSS cannot list (a colour, a length with a unit): it is any string.
- Whether a selector is valid CSS.

A `style` prop of a styled component is checked like a style.

### Steps and global styles

The steps of `keyframes` are flat web properties: a misspelt key and a nested style in a step are type errors. The key of a step is any string (`from`, `'50%'`), so a key that is not a step compiles and throws when `keyframes` runs. In `globalStyles` a key is any string (a selector or an at-rule), and the style under a selector is checked as a web style is; the descriptors of `@font-face`, `@page`, `@counter-style` and `@font-palette-values` are typed by `csstype`.

```ts
import { globalStyles, keyframes } from '@umber-style/core'

// @ts-expect-error a misspelt key
keyframes({ from: { opacty: 0 } })

// @ts-expect-error a step is flat
keyframes({ from: { opacity: 0, '&:hover': { opacity: 1 } } })

// Not caught: a step key that is not an offset is any string; it throws when called.
keyframes({ middle: { opacity: 0 } })

// @ts-expect-error a misspelt key under a selector
globalStyles({ body: { backgroudColor: 'red' } })
```

In the shared types of `umber-style/react` an `animation` key is not in the shared part of a style, because React Native has none: put it in `web`.

### Keys built at run time

A key made from a value, such as a media query from a breakpoint or the key of `when()`, is a computed key. TypeScript gives every computed key in an object literal the type `string`, whatever its template literal type, and checks it against every index signature of `WebStyleObject`. The custom property signature (`--name`) takes no style, so `{ [`@media (min-width: ${bp})`]: { gap: 16 } }` is rejected, though it works at run time. No type can accept the key and still reject a style given to a custom property (the reproduction is in the limits below), so use `at(key, style)`:

```ts
import { at } from '@umber-style/react'

styled('div')(({ theme }) => ({
  gap: 8,
  ...at(`@media (min-width: ${theme.breakpoints[0]})`, { gap: 16 }),
}))

// A misspelt property inside the style is still an error.
styled('div')(({ theme }) => ({
  // @ts-expect-error `gapp` is not a property
  ...at(`@media (min-width: ${theme.breakpoints[0]})`, { gapp: 16 }),
}))
```

`at(key, style)` returns `{ [key]: style }` typed so that it spreads into a style. The key keeps its template literal type, and `style` is checked as a style of its own. The key must be a selector with `&`, one that starts with `:`, or an at-rule (`NestedKey`). `at` is exported by `@umber-style/core`, by every binding and by `umber-style/react`, where it is for the `web` part of a shared style. It is the same function for the keys of `when()` and `whenScheme()`: see [Theme conditions](theme-conditions.md).

A key that TypeScript only knows as `string` (a variable of that type) is an error in `at()` too. Build the key in the call, or type it with a template literal. When that is not possible, cast the whole style: `({ gap: 8, [key]: { gap: 16 } }) as WebStyleObject`.

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

The cases above are those of `packages/umber-style/src/sharedTypes.test.tsx`, which `pnpm typecheck` compiles twice, with and without the `react-native` export condition. The server declarations are compiled with the `react-server` condition (`packages/umber-style/src/sharedServerTypes.test.tsx`).

## Vue

Vue uses the web types for styles. A styled component's props are not typed: `styled` returns a component that takes any attributes. A function style receives the attributes as a `Record<string, unknown>`.

## Server components

Under the `react-server` condition `@umber-style/react` has `useTheme` (a plain function that returns the base theme), `readTheme` (another name of it), and no `ThemeContext`. The compiler picks the server types when its configuration has the `react-server` custom condition (`"customConditions": ["react-server"]` in `compilerOptions`). Without it the types are those of the client build: `readTheme` is reported as missing, and `useTheme` is typed in both. Both `@umber-style/react` and `umber-style/react` follow the condition: under it, `umber-style/react` has `useTheme` and `readTheme`, because that is what it is at run time. See [Server rendering](server-rendering.md).

## The type names apps import

These names describe the same shapes as the types that existing apps import today (the list of names comes from the issue), so that code written against them compiles with only the scope of its imports changed. They are UmberStyle's own types: code that mixes them with types of another library may not line up.

| Name                     | What it is                                                                                                                                      | Declared in                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `CSSObject`              | A style written as an object on the web: `WebStyleObject` under another name                                                                    | `@umber-style/core`                                |
| `Keyframes`              | What `keyframes` returns: the name of the animation, a plain `string`                                                                           | `@umber-style/core`                                |
| `SerializedStyles`       | What `css()` of a web binding returns: a sheet entry, `SheetEntry`                                                                              | `@umber-style/core`                                |
| `Interpolation<Props>`   | Anything `styled` takes: a style object, a `css()` value or entry, a function of the props and `theme`, `null`, `undefined`, `false`, or a list | `@umber-style/core`; each binding with its `Theme` |
| `Theme`                  | The theme of the default style, an interface an app merges its theme into                                                                       | `@umber-style/core`, and each web binding          |
| `UmberCache`             | The cache of `@umber-style/cache`                                                                                                               | `@umber-style/core`                                |
| `StyledComponent`        | A component made by `styled`: a React component in `@umber-style/react`, a Vue component in `@umber-style/vue`                                  | each web binding                                   |
| `StyledOptions`          | The options of `styled(tag, options)`                                                                                                           | each binding                                       |
| `FilteringStyledOptions` | `StyledOptions` whose `shouldForwardProp` is a type guard                                                                                       | each web binding                                   |
| `CreateStyled`           | The type of `styled` itself, with its tag shorthands                                                                                            | each web binding                                   |
| `PropsOf<C>`             | The props of a component or a tag                                                                                                               | each web binding                                   |

`@umber-style/react` (both builds) and `@umber-style/vue` export all of them; `@umber-style/css` re-exports the six of the core; `@umber-style/styled` re-exports the component types of `@umber-style/react` with `CSSObject`, `Interpolation` and `Theme`; `@umber-style/cache` re-exports `UmberCache`. A file needs one import, from the package of its framework:

```tsx
import type { CSSObject, Keyframes, SerializedStyles, StyledComponent } from '@umber-style/react'

const card: CSSObject = { padding: 8, '&:hover': { opacity: 0.8 } }
const raised: SerializedStyles = css(card)
const fade: Keyframes = keyframes`to { opacity: 1; }`

interface ButtonProps {
  tone: 'primary' | 'danger'
}
const Button: StyledComponent<'button', ButtonProps> = styled('button')<ButtonProps>(
  ({ theme, tone }) => ({ color: tone === 'primary' ? theme.palette.primary : 'firebrick' })
)
```

Where the shapes differ from the types apps import today:

- `StyledComponent<C, P>` takes the tag first and the props of its own second (`StyledComponent<'button', ButtonProps>`), not the props first.
- `SerializedStyles` is a sheet entry, not an object with the CSS text: it prints as its class name.
- `Keyframes` is a `string`: it is the name, and it is used as one.

### A `shouldForwardProp` type guard

When `shouldForwardProp` is a type guard, the component takes only the props of the tag that it names, and its own props:

```tsx
const options = {
  shouldForwardProp: (prop: string): prop is 'href' | 'children' =>
    prop === 'href' || prop === 'children',
} satisfies FilteringStyledOptions<ComponentProps<'a'>, 'href' | 'children'>

const Link = styled(
  'a',
  options
)<{ isActive?: boolean }>(({ isActive }) => ({
  fontWeight: isActive ? 'bold' : 'normal',
}))

// @ts-expect-error `title` is not forwarded, so it is not a prop
const dropped = <Link title="x" />
```

TypeScript reads some filters as type guards by themselves: `(prop) => prop === 'id'` is one, and narrows the props to `id`. Give such a filter a `boolean` return type to keep every prop of the tag: `(prop): boolean => prop === 'id'`. A filter like `(prop) => prop !== 'tone'` is not a type guard and keeps them all.

### Two ways to type the theme

The core declares `Theme`. Each web binding declares its own `Theme`, which extends the core's, and that one is the theme of its default style: of `styled`, `useTheme`, `StyleSheet` and `ThemeProvider` imported directly. An app adds its members in either module, or in both:

```ts
// For every binding: the theme shared by React, Vue and React Native.
declare module '@umber-style/core' {
  interface Theme {
    palette: { primary: string; onPrimary: string }
    space: number[]
  }
}

// For React alone, as apps declare their theme today with the scope changed.
declare module '@umber-style/react' {
  interface Theme {
    radii?: { card: number }
  }
}
```

The theme of `@umber-style/react` then has `palette`, `space` and `radii`. The same works with `@umber-style/vue`. Both forms are compiled together by the repository's type tests (`packages/react/src/augmentation.test.tsx`, `packages/vue/src/defaultStyle.test.ts`). `@umber-style/react-native` has no `Theme` of its own: it reads the core's. The types of `umber-style/react` use the `Theme` of `@umber-style/react`.

An engine made for the default style of a binding (`configure({ engine })`) is typed with that binding's `Theme`: `createLazyEngine<Theme>()`, with `Theme` imported from the binding. One made with the core's `Theme` is accepted while the binding adds no required member of its own.

## Limits

- The values of colours and lengths are not checked, on any platform.
- A computed key written directly in a web style object is a type error, whatever its type: use `at()`. The cause is in TypeScript, and was reproduced with 7.0.2. The computed key becomes a `string` index signature of the object, which has to satisfy every index signature of the target, the custom property one included:

  ```ts
  declare const key: `@media ${string}`
  type Nested = { color?: string }
  // Accepted: no custom property signature.
  const a: { color?: string; [k: `@${string}`]: Nested } = { [key]: { color: 'red' } }
  // Rejected: 'string' and '`--${string}`' index signatures are incompatible.
  const b: { [k: `--${string}`]: string; [k: `@${string}`]: Nested } = { [key]: { color: 'red' } }
  ```

  Letting the custom property signature take a style would accept the key and also accept `'--x': { color: 'red' }`.

- The shared types are an intersection: a valid web style (`display: 'block'`) is a type error in shared code and goes in `web`.
- Types do not know which props of a host element `shouldForwardProp` forwards, unless it is a type guard: then they narrow the props to the ones it names, also for a component tag, which receives every prop at run time.
- `styled(tag)` has three call forms (a function first, a template, styles). A mistake in a style is reported against the styles form, and an error message can list the other forms too.
- The props of a template are not inferred from its functions: give them with the type argument.
- The examples were compiled by the type tests of `packages/react/src/typeNames.types.test.tsx`, `packages/react/src/augmentation.test.tsx` and `packages/vue/src/css.test.ts`. No existing app was compiled against these types: the list of names comes from the issue, not from the build output of an app.
- The examples were compiled with TypeScript 7.0.2. Other versions were not tried.
