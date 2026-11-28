# Typed styles

After this page you can tell what the compiler catches in a style on each platform, what it lets through, and how to get past it when you must; how to switch the web types to strict checking; and you know the type names an app imports, where they live, the two ways to type the theme, and how the repository keeps what the types cost the checker.

Each entry checks the keys of a style in an object literal, for its own platform:

| Entry                                              | Keys allowed                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@umber-style/react`, `@umber-style/vue`, the core | every CSS property, nested selectors and at-rules, custom properties (`--x`) and `label`; by default any other key too, unless strict is on |
| `@umber-style/react-native`                        | the platform's view, text and image style keys; nothing nested                                                                              |
| `umber-style/react`                                | only the keys that both of them have, with the values that both accept                                                                      |

`umber-style/vue` and `umber-style` follow the web types. `umber-style/react` is the entry for code that runs on the web and on React Native: use `@umber-style/react` for code that only runs on the web, or you will get the stricter shared types.

## The web

`WebStyleObject` is the type of a style on the web: every CSS property with its values (a number where CSS takes a length, a list for fallbacks), nested styles under a selector or an at-rule, custom properties (`--name`) and `label`. `engine.css`, `createSheet`, `createStyler`, and the `styled`, `StyleSheet.create` and `style` of the web bindings take it. It comes from `@umber-style/core`. The web bindings re-export it as a type, with `WebProperties`, `WebNested`, `NestedKey`, `StyleObject`, `StyleTypeOptions`, `AlphaColor`, `SheetEntry`, `ThemeKey`, `SchemeKey` and `SchemeName`: `@umber-style/react` (both builds), `@umber-style/vue`, and every entry of `umber-style` but `umber-style/react-native`.

The typings of the CSS properties come from the standard `csstype` package. It is a `dependency` of the core and is only imported as a type, so the core has no run-time dependency on it. The declarations the core publishes refer to it, and a consumer without it would see every property as `any`.

### The default types and the strict switch

The web types have two modes. The default one is for code that moves from the styling library it used before and should compile as it is; the strict one checks keys and keywords, and is opted into once for the whole program.

By default a web style takes:

- every CSS property, with the values `csstype` knows (an editor still completes them) and also any string or number, so an object whose values were widened to `string` is accepted;
- any other key, whose value is a nested style or a value: selectors with or without `&`, at-rules, custom properties, and keys computed at run time;
- `null`, `undefined` and `false` for a value.

The `style` prop of a styled component of `@umber-style/react` takes React's `CSSProperties` too, so props spread from `HTMLAttributes` into a styled component compile.

```tsx
const pageSheet = createMemorySheet()
const { styled } = createStyle(
  { palette: { primary: '#1b5fd1' }, breakpoints: ['40em'] },
  { prefix: 'p', cache: createCache({ prefix: 'p', sheet: pageSheet }) }
)

// A value that was widened to string, where nothing typed the object.
const card = { display: 'grid', alignItems: 'start' }
styled('div')(card)

// A key computed at run time.
styled('div')(({ theme }) => ({
  gap: 8,
  [`@media (min-width: ${theme.breakpoints[0]})`]: { gap: 16 },
}))

// Any other key, with a nested style or a value: a misspelt key is not caught.
styled('div')({ backgroudColor: 'red', '> li': { margin: 0 } })

// React's CSSProperties in the style prop.
const Box = styled('div')({ padding: 8 })
const inline: CSSProperties = { marginTop: 4 }
render(<Box style={inline} />)

// @ts-expect-error a boolean is never a value
styled('div')({ padding: true })
// @ts-expect-error `label` is a string
styled('div')({ label: 1 })
```

(This is a case of `packages/react/src/styleTypes.default.test.tsx`, which also holds the shapes of a design system that compiled against these types unchanged.)

What the default catches: a value of a type that no property takes (`true`, an object for a property), a `label` that is not a string, and a misspelt key in a step of `keyframes` (a step takes properties only). What it does not catch: a misspelt key, a keyword that does not exist, and a selector without `&`, which is a descendant selector.

The strict types are switched on by one declaration, in any file of the program:

```ts
declare module '@umber-style/core' {
  interface StyleTypeOptions {
    isStrict: true
  }
}
```

`StyleTypeOptions` is an interface of the core that an app merges into, as it does with `Theme`. Every web binding re-exports it, so the declaration can name the module the app imports: `@umber-style/react`, `@umber-style/vue`, `@umber-style/css`, `@umber-style/styled` or `umber-style/react`. It is one switch for the whole program, not for a file. The repository compiles its strict type tests with it (`tsconfig.strict.json` of `core`, `react`, `vue` and `umber-style`), and its default ones without it.

### With the strict switch

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

What the strict types check:

- In an object literal, a key that is not a property, a selector or an at-rule (`backgroudColor`).
- A wrong value where the property's typing is a closed set of keywords: `display: 'gird'`, `position: 'abslute'`, `flexDirection: 'rows'` and `textAlign: 'midle'` are errors. `display` is written out by the engine, because `csstype` lets any string through for it; the others come from `csstype`. A property whose typing admits any string is not checked: `cursor: 'ponter'` compiles.
- A nested style under a selector (a key with `&`, or one that starts with `:`) or an at-rule (a key that starts with `@`) is itself checked as a style.
- A key that starts with `:` (`':hover'`, `'::before'`) is the element itself, written as if it were `'&:hover'`: the rule is `.class:hover`. A key with no `&` that does not start with `:` (`'span'`, `'> li'`) is an error in an object literal, because it would be a descendant selector; the loose `StyleObject` writes it as one.

What the strict types do not check:

- A misspelt key in an object that a variable holds, or in the object that a style function returns without a return type. Give the function a return type of `WebStyleObject`, or end the literal with `satisfies WebStyleObject`.
- A value that CSS cannot list (a colour, a length with a unit): it is any string.
- Whether a selector is valid CSS.

A `style` prop of a styled component is checked like a style. With the strict types it takes no `CSSProperties`: a `style` spread from `HTMLAttributes` is a type error there.

### Steps and global styles

The steps of `keyframes` are flat web properties: a misspelt key and a nested style in a step are type errors, in both modes (by default a property of a step takes any string or number, as in a style). The key of a step is any string (`from`, `'50%'`), so a key that is not a step compiles and throws when `keyframes` runs. In `globalStyles` a key is any string (a selector or an at-rule), and the style under a selector is checked as a web style is (by default it takes any key, so the misspelt key below compiles); the descriptors of `@font-face`, `@page`, `@counter-style` and `@font-palette-values` are typed by `csstype`.

With the strict switch:

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

In the shared types of `umber-style/react` the `animation*` and `transition*` keys are in the shared part of a style: React Native runs them with its animated entry, and drops them, with a development warning, without it (see [Animations](react-native.md#animations)).

### Keys built at run time

A key made from a value, such as a media query from a breakpoint or the key of `when()`, is a computed key. By default it is written directly, as the example above shows: the default style takes any key. With the strict types it is not: TypeScript gives every computed key in an object literal the type `string`, whatever its template literal type, and checks it against every index signature of `WebStyleObject`. The custom property signature (`--name`) takes no style, so `{ [`@media (min-width: ${bp})`]: { gap: 16 } }` is rejected, though it works at run time. No type can accept the key and still reject a style given to a custom property (the reproduction is in the limits below), so use `at(key, style)`, in either mode:

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

`at(key, style)` returns `{ [key]: style }` typed so that it spreads into a style. The key keeps its template literal type, and `style` is checked as a style of its own. The key must be a selector with `&`, one that starts with `:`, or an at-rule (`NestedKey`). `at` is exported by `@umber-style/core`, by every binding and by `umber-style/react`, where it is for the `web` part of a shared style. It is the same function for the keys of `when()` and `whenScheme()`: see [Theme conditions](theme-conditions.md), and for the keys of `state()`.

A key that TypeScript only knows as `string` (a variable of that type) is an error in `at()`, in both modes: by default write such a key directly. With the strict types, build the key in the call, or type it with a template literal; when that is not possible, cast the whole style: `({ gap: 8, [key]: { gap: 16 } }) as WebStyleObject`.

### State keys

`state(name)` takes `'hovered' | 'pressed' | 'focused' | 'disabled'` (`StateName`): any other name is a type error. It returns `StateKey`, typed as any `` `@state ${string}` `` key, as the key of `when()` is typed as any `@theme` key. So the key passes the style types of every platform: alone or next to other keys, written directly as a computed key or spread from `at`, in a web style, a native style and a shared one (`packages/react-native/src/states.test.tsx`, `packages/umber-style/src/sharedConditions.test.tsx`):

```tsx
const Button = styled(Host)({ ...at(state('pressed'), { opacity: 0.7 }) })
const Card = styled(Host)(
  { opacity: 1, ...at(state('disabled'), { opacity: 0.4 }), [state('hovered')]: { opacity: 0.9 } },
  () => ({ web: { ...at(state('focused'), { outlineWidth: 2 }) } })
)

// @ts-expect-error not one of the four states
state('active')
```

The style inside `at()` is checked as a web style (`WebNested`), as for any key of `at`. A styled component of React Native and of `umber-style/react` takes the props `pressed`, `hovered` and `focused` (`StateProps`, booleans), which tell the state to a component that does not report it itself: `<Button pressed />`. The `style` prop of a styled component does not take a function.

### The escape hatch

`StyleObject`, with any key, is the loose type that the serializer works on. The default web types accept it as it is. With the strict types, to use a key that the types do not know (a property that is too new for `csstype`), cast the style to the type of the platform:

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

Nothing is warned in production. The strict switch does not change these types: they are the platform's own, and the default for the web does not loosen them. The `web`-only keys (`label`, selectors, at-rules, custom properties) are dropped when a style is turned into a native style.

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

`web` takes a web style and `native` takes a native style, so a nested selector inside `native` is an error, and, with the strict switch, a native-only key inside `web` is one too (by default `web` takes any key, as a web style does). The types are `SharedStyleObject`, `WebStyleObject` and `NativeStyleObject`. `SharedStyleObject` is from `umber-style/react`; the other two are from `@umber-style/core` and `@umber-style/react-native`.

A tag name such as `'div'` type-checks in shared code and throws on React Native, so give `styled` a component there. See [Style sheets and the style prop](style-sheets.md) for a pattern that does this.

To use a key that a type does not know, cast the style to the type of the platform: `style as WebStyleObject`, or `style as NativeStyleObject`.

The cases above are those of `packages/umber-style/src/sharedTypes.test.tsx`, which `pnpm typecheck` compiles twice with the strict switch, with and without the `react-native` export condition (`tsconfig.strict.json`, `tsconfig.strict.native.json`). The server declarations are compiled with the `react-server` condition (`packages/umber-style/src/sharedServerTypes.test.tsx`).

## Vue

Vue uses the web types for styles, in the same two modes: `declare module '@umber-style/vue' { interface StyleTypeOptions { isStrict: true } }` switches them to strict. A styled component's props are not typed: `styled` returns a component that takes any attributes, `style` included. A function style receives the attributes as a `Record<string, unknown>`. `StyleProp` and `SheetStyleProp` are exported for a component of your own that types its `style` (see [Sheet entries only](#sheet-entries-only)).

## Sheet entries only

Each binding and `umber-style/react` export two types for a `style` prop: `StyleProp`, what the `style` of a styled component takes, and `SheetStyleProp`, the part of it that takes sheet entries only, for a design system whose components take no plain style objects. The names are the same everywhere.

| Package                     | `StyleProp` takes                                                                               | `SheetStyleProp` takes                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@umber-style/react`        | entries, handles, web style objects, `CSSProperties` (not with the strict switch), falsy, lists | entries (`StyleSheet.create`, `useStyle`, `css()`), handles, `false`, `null`, `undefined`, nested lists                     |
| `@umber-style/vue`          | entries, handles, web style objects, falsy, lists                                               | the same as React                                                                                                           |
| `@umber-style/react-native` | native style objects (the platform's own included), handles, falsy, lists                       | `SheetStyleProp<S = ViewStyle>`: the entries of the binding (`StyleSheet.create`, `useStyle`), handles, falsy, nested lists |
| `umber-style/react`         | `SharedStyleProp`: shared entries, handles, shared style objects, falsy, lists                  | shared entries (`StyleSheet.create`, `useStyle`, `css()`), handles, falsy, nested lists                                     |

A plain style object and a string are type errors in `SheetStyleProp`, on every platform. A `SheetStyleProp` is a `StyleProp`, so a component passes it on to the `style` of one of its parts as it is. From `packages/react/src/sheetStyleProp.types.test.tsx`:

```tsx
const object = StyleSheet.create({ a: { color: 'red' } })
const themed = StyleSheet.create((theme) => ({ b: { color: theme.palette.primary } }))
const accepted: SheetStyleProp[] = [
  object.a,
  themed.b,
  [object.a, [themed.b, false]],
  null,
  undefined,
  false,
  css({ color: 'red' }),
]
const asStyle: StyleProp = accepted

// @ts-expect-error a plain object
const plain: SheetStyleProp = { color: 'red' }
// @ts-expect-error a string
const text: SheetStyleProp = 'x'
```

`themed.b` is a handle, typed `ThemedEntry` ([Style sheets](style-sheets.md#a-sheet-of-the-theme-without-a-hook)). It carries its sheet's names, so a misspelt name is a type error, and it is not taken by `apply`, `css()`, `useStyle` or the `style` of a plain element.

On React Native an entry of the binding is typed `NativeSheetEntry`: a native style with a mark that exists for the compiler only, which a plain object and a style of the platform's `StyleSheet.create` do not have; `StyleProp` still takes both. `S` is the kind of the component the prop is for, `ViewStyle`, `TextStyle` or `ImageStyle`, and picks the keys the entry is typed with; an entry of the binding has every key, so it fits every kind. From `packages/react-native/src/themedStyle.test.tsx`:

```tsx
const object = StyleSheet.create({ box: { margin: 1 }, label: { fontSize: 12 } })
const view: SheetStyleProp[] = [object.box, sheet.card, [false, [null, sheet.tone]], undefined]
const text: SheetStyleProp<TextStyle> = [object.label, sheet.card]
const image: SheetStyleProp<ImageStyle> = object.box

const own = platformSheet.create({ box: { margin: 1 } })
// @ts-expect-error a plain object
const plain: SheetStyleProp = { margin: 1 }
// @ts-expect-error a style of the platform StyleSheet
const registered: SheetStyleProp = own.box
const taken: StyleProp = [{ margin: 1 }, own.box]
```

In `umber-style/react` the one type serves both platforms: `packages/umber-style/src/sharedSheetStyleProp.test.tsx` is compiled with and without the `react-native` export condition.

A prop typed `SheetStyleProp` takes entries from the side it is on: a style does not cross from a server component to a client component ([A style passed from a server component](style-sheets.md#a-style-passed-from-a-server-component)).

## Server components

Under the `react-server` condition `@umber-style/react` has `useTheme` (a plain function that returns the base theme), `readTheme` (another name of it), and no `ThemeContext`. The compiler picks the server types when its configuration has the `react-server` custom condition (`"customConditions": ["react-server"]` in `compilerOptions`). Without it the types are those of the client build: `readTheme` is reported as missing, and `useTheme` is typed in both. Both `@umber-style/react` and `umber-style/react` follow the condition: under it, `umber-style/react` has `useTheme` and `readTheme`, because that is what it is at run time. See [Server rendering](server-rendering.md).

## The type names apps import

These names describe the same shapes as the types that existing apps import today (the list of names comes from the issue), so that code written against them compiles with only the scope of its imports changed. They are UmberStyle's own types: code that mixes them with types of another library may not line up.

One import of an app that moves over changes by more than the scope: the prop filter. Its path names the platform, because each platform takes other props: `import isPropValid from '@umber-style/is-prop-valid/react'` (or `/vue`, `/react-native`), and the package has no root entry. See [Prop filters](prop-filters.md).

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
| `CreateStyledComponent`  | What `styled(tag, options)` returns, with the props of the component given as type arguments: the type a wrapper of `styled` returns            | `@umber-style/react`                               |

`@umber-style/react` (both builds) exports all of them, and `@umber-style/vue` all but `CreateStyledComponent`; `@umber-style/css` re-exports the six of the core; `@umber-style/styled` re-exports the component types of `@umber-style/react` with `CSSObject`, `Interpolation` and `Theme`; each of them also re-exports `StyleTypeOptions`; `@umber-style/cache` re-exports `UmberCache`. A file needs one import, from the package of its framework:

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

### A wrapper of `styled`

A design system often has a `styled` of its own, which adds options and styles and passes the rest to `styled`. It is typed with `CreateStyledComponent<ComponentProps, SpecificComponentProps, JSXProps>`: the props of the component, in two parts (a wrapper puts its own, such as `theme`, in the first, and the props of the tag in the second), and props that only the element takes (`ref`). Called with styles, it makes a component that takes all of them, the props given as its type argument (`<{ tone?: string }>`), `as` and `style`. A function style reads the same props, the ones of the type argument over the others, and `theme`. `StyledFactory`, what `styled(tag)` returns, is `CreateStyledComponent` with the props of the tag. `StyledOptions<Props>` takes the props of the tag as a type argument that changes nothing, so that a wrapper can name it next to `FilteringStyledOptions<Props, Forwarded>`.

```tsx
type WrappedTags = {
  [Tag in keyof JSX.IntrinsicElements]: CreateStyledComponent<
    { theme?: AppTheme; as?: ElementType },
    JSX.IntrinsicElements[Tag]
  >
}

interface WrappedStyled extends WrappedTags {
  <Tag extends keyof JSX.IntrinsicElements>(
    tag: Tag,
    options?: StyledOptions<JSX.IntrinsicElements[Tag]> & CustomizationOptions
  ): CreateStyledComponent<{ theme?: AppTheme; as?: ElementType }, JSX.IntrinsicElements[Tag]>
  // ...and the forms for a component, and with FilteringStyledOptions.
}

const styled = Object.assign(
  createCustomizable as unknown as CreateStyled,
  baseStyled
) as unknown as WrappedStyled

const Box = styled('div', { name: 'Box', label: 'Box' })<{ tone?: 'primary' | 'text' }>(
  ({ theme, tone = 'primary', ...props }) => ({
    color: theme.palette[tone],
    padding: theme.space[1],
  })
)
```

`theme` is `AppTheme` and `props` holds the props of a `div`, with no annotation, under `strict`. `Object.assign` copies the tag shorthands, which are own members of `styled` (see [Writing styles](writing-styles.md#tag-shorthands)). The whole wrapper, with five forms, a class component with a `ref`, and a function of the theme that returns a list, is `packages/react/src/styledWrapper.types.test.tsx`.

The `theme` of `ThemeProvider` of the default style takes the theme of such an app as it is, an object or a function of the theme above whose parameter the app types, while the app has not declared its members in `Theme`:

```tsx
const derive = (outer: AppTheme): AppTheme => ({ ...outer, name: `${outer.name} derived` })

<ThemeProvider theme={appTheme}>
  <ThemeProvider theme={derive}>{children}</ThemeProvider>
</ThemeProvider>
```

A `Theme` with no members of its own has one optional member, and TypeScript rejects an object that shares no member with a type whose members are all optional. So while `Theme` has no other member, the provider takes any object, or a function of the theme above. Once an app declares its theme in `Theme`, the provider takes that theme, or a part of it, and checks it.

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

## How the cost of the types is kept

A design system often has a base component whose props are the attributes of an element and its groups of style props: several hundred members. Each component styled from it makes the type checker build the props of the base without the props the component names, twice: the props a function style reads, and the props of the element. Filtering hundreds of keys once for each component is what costs.

The types of `@umber-style/react` skip that work where it changes nothing. Where the props given as the type argument name no prop of the tag (`styled(Flex)<{ isOpen: boolean }>`), nothing is removed, so the props of the tag are used as they are: one type for each tag, made once and shared by every component styled from it. Where they share props (props that extend the base's, `interface PanelProps extends FlexProps`), the props of the tag without them are computed as before. The types are the same either way; what compiles and what is an error did not change.

On the design system these types were measured with (220 `styled` calls, a base of several hundred props, a wrapper of `styled` with five overloads), `tsc --noEmit --extendedDiagnostics` with TypeScript 7.0.2 counted, against the published declarations:

| Types of `@umber-style/react` | Instantiations | Types   | Memory | Check time |
| ----------------------------- | -------------- | ------- | ------ | ---------- |
| 0.1.0                         | 1,938,543      | 349,873 | 695 MB | 0.748 s    |
| 0.1.1                         | 1,374,738      | 274,576 | 674 MB | 0.703 s    |

(The median of three runs, on one machine. The same package with the styling library it moved from counted 1,036,010 instantiations, 223,083 types, 632 MB and 0.652 s.)

`pnpm typecheck` keeps the cost from growing back. The typecheck of `@umber-style/react` ends with `scripts/check-type-cost.mjs`, which compiles `packages/react/type-cost/designSystem.tsx`: the shapes above written fresh, a base component of about 370 props, a wrapper of `styled` with the five overloads, twenty components styled from the base (six with props that extend the base's, fourteen with a few of their own) and an element of each. It subtracts the count of `engineOnly.ts`, which imports the same modules and uses nothing, so the number is the cost of those shapes and not of the engine's own source. It fails when the number is above the budget in the script, 164,000: about 20% over the 136,522 that the types count now. The types of 0.1.0 count 175,941 there.

The number is a count of instantiations: how many times the checker made a generic type for some type arguments (a `Pick`, an `Omit`, each member of a conditional type). For one version of TypeScript and of `@types/react` it is the same on every run, where a time is not, so a budget can be exact. The script compiles with `--singleThreaded`: with several checkers, a type that two files need is made once in each, and how the files are shared out moves the total. When TypeScript or `@types/react` is upgraded, the count moves: measure it again and set the budget the same way.

## Limits

- The values of colours and lengths are not checked, on any platform.
- The `style` attribute of a Vue styled component is not typed as `StyleProp`: it takes any value, and a string fails at run time only.
- On React Native the kind `S` of `SheetStyleProp<S>` does not tell a text entry from a view entry: the entries of the binding are typed with every key. The mark of `NativeSheetEntry` is not checked at run time; a value cast to it passes.
- `SheetEntry` is an interface of one member, `className`: an object of your own with a `className` string type-checks as an entry.
- `StateKey` is any `@state` key, so a key written by hand (`'@state pressd'`) type-checks: only the argument of `state()` is checked. The state props are typed on every styled component, also one whose styles name no state, where they are forwarded as any prop.
- By default a misspelt key, a keyword that does not exist (`display: 'gird'`) and a selector without `&` compile, in a nested style as at the top: that is the price of the drop-in. The strict switch catches them again, for the whole program; it cannot be switched on for one file.
- By default the extra keys of a style must hold a style or a value: an object typed with another key whose value is neither (a shared style with its `native` part, given to the `styled` of a web binding) is a type error where the strict types accepted it, because the strict types have no index signature for such a key.
- By default a style typed by an interface, such as a variable of type `CSSProperties`, is not taken as an argument of `styled`, `css` or a sheet: an interface has no index signature. The `style` prop takes `CSSProperties`; elsewhere spread it, `{ ...inline }`.
- The `style` declared by the props of a component's own (props that extend `HTMLAttributes` have one) is replaced by the `style` of the styled component, which takes everything it took; before it was the intersection of the two, in both modes.
- With the strict switch, a computed key written directly in a web style object is a type error, whatever its type: use `at()`. The cause is in TypeScript, and was reproduced with 7.0.2. The computed key becomes a `string` index signature of the object, which has to satisfy every index signature of the target, the custom property one included:

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
- A function style reads the props of the tag too, and the props of the type argument win over them: a prop that both name (`size` of an `input`) has the type of the type argument, not an intersection of the two.
- The cost of the types is still above that of the styling library an app moves from, on the one design system it was measured with: 33% more instantiations, 23% more types, 7% more memory and 8% more check time. Most of the rest is where a component's props extend the base's, and the props of the base without them are computed for each component.
- The budget of `check-type-cost.mjs` counts instantiations, single-threaded, on one fixture. It does not measure time or memory, nor the cost of a shape that the fixture does not have; the check times above were measured on one machine, which other work on it moves by several percent.
- While `Theme` has no member of its own, the `theme` of `ThemeProvider` of the default style is not checked against the app's theme, and a function given to it with no type on its parameter gets `object`. `useTheme()` then returns `Theme`, which has none of the app's members: declare them in `Theme`, or cast.
- With the strict switch, the `style` prop of a styled component takes sheet entries and web style objects, not React's `CSSProperties`: props spread from `HTMLAttributes` into a styled component (`<Root {...rest} />` with `style` in `rest`) are a type error. TypeScript reports it twice: the error, and "Expression produces a union type that is too complex to represent", which it hits while it explains the first. It was reproduced with a union that holds the strict style and an object of many keys that does not fit it; a union that holds only the properties does not give it, which points at the pattern index signatures of the strict style. The default types give neither error.
- With the strict switch, a style object whose type was inferred where nothing typed it (a function with no return type that is not written in the call, or a variable) has `display: string`, which is not one of the values of `display`: give it a return type of `WebStyleObject`, use `satisfies`, or write `'flex' as const`.
- The examples were compiled by the type tests of `packages/react/src/styleTypes.default.test.tsx`, `packages/react/src/typeNames.types.test.tsx`, `packages/react/src/styledWrapper.types.test.tsx`, `packages/react/src/augmentation.test.tsx` and `packages/vue/src/css.test.ts`; the strict ones with the switch (`packages/react/src/webStyle.test.tsx`, `packages/core/src/globalStyles.test.ts`). The wrapper of `styledWrapper.types.test.tsx` has the shape of the one of a design system that was compiled against these types; `styleTypes.default.test.tsx` holds the shapes of its components that the strict types reject: the `CSSProperties` of a spread, a widened value, a computed key.
- The examples were compiled with TypeScript 7.0.2. Other versions were not tried.
