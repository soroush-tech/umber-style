# React Native

After this page you can use the React Native binding: styled native components, sheets, the real theme values, and the parts of the API that work differently because there are no classes.

`@umber-style/react-native` needs `react` `^19.0.0` and `react-native` `>=0.76.0`; its animated entry needs react-native-reanimated 4.7 or 4.8, which need React Native 0.86 to 0.88 and 0.87 to 0.89 (see [Animations](#animations)). It has the same names as the React binding, over the real theme values. React Native has no CSS, so there are no variables, no classes, no cascade layers and no style element: a style is an object of the platform's own keys, and a theme value in a style function is the value itself.

## An example

```tsx
import { Pressable, Text, View } from 'react-native'
import { createStyle, multiply } from '@umber-style/react-native'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

const { styled, ThemeProvider, StyleSheet, useStyle } = createStyle(theme)

const Button = styled(Pressable)(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  padding: multiply(theme.space[2], 2),
  borderRadius: 8,
}))
const Label = styled(Text)(({ theme }) => ({ color: theme.palette.onPrimary }))

const sheet = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', gap: theme.space[2] },
}))

function Row() {
  const styles = useStyle(sheet)
  return (
    <View style={styles.row}>
      <Button>
        <Label>Save</Label>
      </Button>
    </View>
  )
}

const App = () => (
  <ThemeProvider theme={theme}>
    <Row />
  </ThemeProvider>
)
```

The components receive these `style` props:

| Component   | `style`                                                          |
| ----------- | ---------------------------------------------------------------- |
| `View`      | `{ flexDirection: 'row', gap: 8 }`                               |
| `Pressable` | `[{ backgroundColor: '#1b5fd1', padding: 16, borderRadius: 8 }]` |
| `Text`      | `[{ color: '#ffffff' }]`                                         |

`styled` gives the component an array (its styles, then the `style` you pass); `useStyle` gives the object itself.

## What is different

| Area                             | React Native                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `styled(tag)`                    | Needs a component. A string such as `'div'` throws a `TypeError`                                                                                                                                                                                                                                                                                                                                   |
| `styled` options                 | `shouldForwardProp` is used (`@umber-style/is-prop-valid/react-native` is a filter of the props of the built-in components, opt-in: see [Prop filters](prop-filters.md#react-native)), and `name` names the component in the development warnings. `slot` is accepted and ignored: there are no class names                                                                                        |
| Forwarded props                  | Every prop but `as`, `theme` and `style`. `style` is rebuilt: the styles, then yours. Where the styles name a `state()` key, `pressed`, `hovered` and `focused` are read and not forwarded, unless `shouldForwardProp` returns true for them: see [Interaction states](#interaction-states)                                                                                                        |
| Style functions                  | Receive the real theme, with its lengths as numbers: `theme.space[2]` is `8`, also when the theme says `'8px'`. They run on each render                                                                                                                                                                                                                                                            |
| Object styles                    | Registered once with the platform `StyleSheet`, when the component is made; one with media query keys, once for each set of matching queries                                                                                                                                                                                                                                                       |
| `StyleSheet`                     | The platform's `StyleSheet`, with a `create` that resolves a function of the theme and registers the styles                                                                                                                                                                                                                                                                                        |
| `StyleSheet.create(object)`      | The registered styles themselves, usable at once, with no hook and no theme. Registered with the platform once, when the first key is read. A `when()`, `whenScheme()` or `@media` key is dropped: use a function, which is resolved against the providers and the window                                                                                                                          |
| `useStyle(sheet)`                | Returns style objects. Sheets made from a function are registered once for each theme object and each set of matching media queries; an object sheet is returned as it is                                                                                                                                                                                                                          |
| Styles before the first function | Each plain object of `styled` is registered once with the platform when the component is made, and the functions run on each render: the split that the web makes into a base class already holds here, so there is nothing to change                                                                                                                                                              |
| `apply(...entries)`              | Returns `{ style: [...] }`: the entries that are not falsy                                                                                                                                                                                                                                                                                                                                         |
| `css(...styles)`                 | Returns one native style: each style turned into a native style as a sheet entry is (lengths in `px` and `rem` are numbers, web-only keys dropped), merged in order. As a tag, the template is read as CSS text and turned the same way: `padding-top: 8px` is `{ paddingTop: 8 }`; a shorthand with several values stays a string and is warned about. `styled` does not take a template here yet |
| `ThemeProvider`                  | Takes `theme` (an object, or a function of the theme above), `colorScheme` and `children`. `className` and `isRoot` are accepted and ignored. It renders no element, outermost or nested: the theme reaches styles as real values through context, and a theme change renders the subtree again                                                                                                    |
| `ThemeScope`                     | Renders its children. A modal stays inside the React tree, so its content already reads the theme of the provider above it                                                                                                                                                                                                                                                                         |
| `useThemeClass()`                | Always `undefined`                                                                                                                                                                                                                                                                                                                                                                                 |
| `ThemeContext`                   | The React context of the real theme, as on the web; `undefined` with no provider above                                                                                                                                                                                                                                                                                                             |
| `themeClass(...)`                | Always `''`                                                                                                                                                                                                                                                                                                                                                                                        |
| `when`, `whenScheme`             | Matched at render against the nearest provider: see [Theme conditions](theme-conditions.md)                                                                                                                                                                                                                                                                                                        |
| `state`                          | Matched at render against what the component is doing: see [Interaction states](#interaction-states)                                                                                                                                                                                                                                                                                               |
| `withTheme`, `withStyle`         | As on the web: `useTheme()` and `useStyle(sheet)` as props, for a class component; `withStyle` follows the window and the color scheme as `useStyle` does. See [Class components](#class-components-withtheme-and-withstyle)                                                                                                                                                                       |
| `useTheme()`                     | The real theme values, merged over the providers above, with the lengths as numbers. With no provider, the base theme, or an empty object when there is none: a style function then gets an empty theme                                                                                                                                                                                            |
| `createStyle` options            | Accepted so that one call runs on both platforms. `remBase` and `lengthKeys` are used (see [Values with CSS units](#values-with-css-units)), and `animated` (see [Animations](#animations)); the others are not, and in development one warning names each of them that was given                                                                                                                  |
| `configure`                      | `theme`, `remBase`, `lengthKeys` and `animated` are used. Throws after first use, as on the web                                                                                                                                                                                                                                                                                                    |
| Engine                           | There is none: no `getEngine`, `engine` or `cache`                                                                                                                                                                                                                                                                                                                                                 |

The base theme is the one you give with `configure({ theme })` or `createStyle(theme)`; a provider never sets it, so a tree with no provider above has that theme, or an empty object, also after a provider unmounted. A merge keeps the helper functions of a raw key (`breakpoints.up`), as on the web. The names of the web that have no meaning here (`ThemeScope`, `useThemeClass`) exist so that one source with a nested provider and portal or modal content compiles for both: see [Themes](themes.md).

## Style objects

A style is a `NativeStyleObject`. When the binding turns a style into a native style it:

- drops the keys that only the web has, each whole: `label`, selectors (a key with `&` or one that starts with `:`), at-rules other than `@media`, and custom properties;
- keeps objects and arrays under any other key (`shadowOffset`, `transform`);
- merges the `native` part of a shared style over the rest and drops the `web` part;
- merges the parts of `when()` and `whenScheme()` keys that match, the blocks of `@media` keys that match the window (see [Media queries](#media-queries)), and the parts of `state()` keys whose state holds (see [Interaction states](#interaction-states));
- turns a length or a number written as text into a number (`padding: '8px'` is `8`): see [Values with CSS units](#values-with-css-units).

In development it warns about what it drops by mistake and about values it cannot convert: see [Development warnings](#development-warnings) and [Typed styles](typed-styles.md).

## Values with CSS units

A theme written for the web holds its lengths as text (`'8px'`, `'1rem'`, `'0'`), and so do styles. React Native takes numbers, so the binding converts them: in the theme, once, and in a style, when it is resolved.

```tsx
import { View } from 'react-native'
import { createStyle } from '@umber-style/react-native'

const theme = {
  palette: { primary: '#1b5fd1' },
  space: ['0px', '4px', '8px'],
  radii: { sm: '2px', round: '50%' },
  borderWidths: { thin: '1px' as const },
  sizes: { full: '100%', fit: 'auto' },
  fontSizes: { body: '1rem' as const },
}

const { styled, useTheme } = createStyle(theme)

const Box = styled(View)(({ theme }) => ({
  padding: theme.space[2],
  borderRadius: theme.radii.sm,
  borderWidth: theme.borderWidths.thin,
  width: theme.sizes.full,
  height: theme.sizes.fit,
  fontSize: theme.fontSizes.body,
  backgroundColor: theme.palette.primary,
}))
```

`Box` passes `[{ padding: 8, borderRadius: 2, borderWidth: 1, width: '100%', height: 'auto', fontSize: 16, backgroundColor: '#1b5fd1' }]`, and `useTheme().space` is `[0, 4, 8]`.

### The rule

What a string becomes depends on the key it is under. The keys come from the platform's own style types: a key whose value type takes any number, apart from the colours (a colour takes a number too), is converted. Of those, the unitless ones are numbers; the rest are lengths.

| Value                                             | Under a length key          | Under a number key       | Under any other key      |
| ------------------------------------------------- | --------------------------- | ------------------------ | ------------------------ |
| `'8px'`, `'-8px'`, `'1.5px'`, `'8PX'`             | `8`, `-8`, `1.5`, `8`       | as it is, with a warning | as it is, with a warning |
| `'8'`, `'0'`, `'-8'`, `'1.5'`                     | `8`, `0`, `-8`, `1.5`       | `8`, `0`, `-8`, `1.5`    | as it is                 |
| `'1rem'`, `'0.5rem'`                              | `16`, `8` (times `remBase`) | as it is, with a warning | as it is, with a warning |
| `'50%'`, `'auto'`                                 | as it is                    | as it is                 | as it is                 |
| `'1em'`, `'100vh'`, `'calc(...)'`, `currentColor` | as it is, with a warning    | as it is, with a warning | as it is, with a warning |
| a colour, any other text                          | as it is                    | as it is                 | as it is                 |

White space around the value is cut first, as the arithmetic helpers do. A value that is not a string costs one type check. `fontWeight: '700'`, `fontFamily`, `fontVariant`, `transform`, `boxShadow` and the colours are never converted: their text is meaningful.

- **Length keys:** `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `top`, `right`, `bottom`, `left`, `start`, `end`, `inset` and its `Block` and `Inline` forms, `margin` and `padding` with every side and axis (`marginTop`, `paddingHorizontal`, `marginBlockStart`, ...), `gap`, `rowGap`, `columnGap`, `flexBasis`, `borderWidth` and every side of it, `borderRadius` and every corner of it, `outlineOffset`, `outlineWidth`, `shadowRadius`, `textShadowRadius`, `elevation`, `fontSize`, `letterSpacing` and `lineHeight`.
- **Number keys:** `opacity`, `shadowOpacity`, `zIndex`, `flex`, `flexGrow`, `flexShrink` and `aspectRatio`.

The lists are `LENGTH_KEYS` and `NUMBER_KEYS` in `packages/react-native/src/units.ts`; a type test checks them against the platform's view, text and image style types, so a key the platform adds or changes fails `pnpm typecheck`.

### In the theme

The theme is converted where the provider merges it, once for each theme object, and remembered for that object: `useTheme()`, a style function and a sheet made from a function all get numbers, and a render that keeps the same theme object converts nothing. The base theme with no provider is converted once too.

A theme has any shape, so only the values under the length keys of the theme are converted, as the web declares only those with `px`: `space`, `sizes`, `radii`, `fontSizes` and `borderWidths`, or the `lengthKeys` option when it is given (a list replaces the default). Under them, every string at any depth that is a length in `px`, `rem` or no unit becomes a number; a percentage, `auto`, a function and the other members of an array (`space.small`) are kept. Every other key is left as it is: `breakpoints` (with its helper functions), the palette, `lineHeights` (a unitless line height is a factor on the web).

A function given to the `theme` prop of a provider receives the theme above as it was given, not converted, so that one source does the same on both platforms; what it returns is converted with the rest.

### The base of `rem`

`'1rem'` is `16` unless `remBase` is set, on `createStyle(theme, { remBase: 10 })` or `configure({ theme, remBase: 10 })`. It applies to the theme and to styles. `em` is not converted: a style does not know the font size around it.

### The arithmetic helpers

`add`, `subtract`, `multiply`, `divide` and `negate` read a string the way a style value is read: a number with `px` or no unit, or a percentage. They throw for `rem`, because a helper has no base for it; a token in `rem` is a number by the time a style function reads it, so `multiply(theme.fontSizes.body, 2)` works.

### Types

What reads the theme (`useTheme()`, the `theme` of a style function, a sheet made from a function, `ThemeContext`) is typed `NativeTheme<T>`: under the default length keys, a length literal type (`` `${number}px` ``, `` `${number}rem` ``, `` `${number}` ``) is `number`, a plain `string` is `string | number` (it may be `'50%'`), and everything else is `T` itself. A key that takes only a number (`borderWidth`, `fontSize`) needs a token typed as a length literal, as `'1px' as const` above, or a number. What takes a theme (`ThemeProvider`, `when`) takes `T`.

## Media queries

A key that starts with `@media` is evaluated by the binding against the window and the system settings, the way the style props of `@soroush.tech/styled-system` and a hand-written responsive style write it. The block of a query that matches is merged into the style; the block of one that does not is left out.

```tsx
import { Text, View } from 'react-native'
import { createStyle, useMediaQuery } from '@umber-style/react-native'

const theme = { space: [0, 4, 8, 16] }
const { styled } = createStyle(theme)
const tablet = `@media (width >= ${600}px)`

const Row = styled(View)(({ theme }) => ({
  flexDirection: 'column',
  gap: theme.space[1],
  [tablet]: { flexDirection: 'row', gap: theme.space[3] },
}))

function Toolbar() {
  const isWide = useMediaQuery('(min-width: 600px)')
  return <Row>{isWide ? <Text>Save and close</Text> : <Text>Save</Text>}</Row>
}
```

In a window 400 wide, `Row` passes `[{ flexDirection: 'column', gap: 4 }]` and the text is `Save`; at 700 it passes `[{ flexDirection: 'row', gap: 16 }]` and the text is `Save and close`.

The native style type has no literal at-rule key, so the key is computed (a template literal, as a key from a breakpoint is), as the key of `when()` is.

### What is evaluated

| Part of a query                                   | Evaluated                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min-width`, `max-width`, `width`                 | Against the width of the window. `width` is an exact match                                                                                                       |
| `min-height`, `max-height`, `height`              | Against the height of the window                                                                                                                                 |
| The range form                                    | `width >= 600px`, `width > 600px`, `<=`, `<`, `=`, the length on either side (`600px <= width`), and both ends (`400px <= width < 800px`); the same for `height` |
| `orientation: portrait \| landscape`              | Portrait when the height is at least the width, as on the web                                                                                                    |
| `prefers-color-scheme: light \| dark`             | Against the system color scheme (`Appearance`); no scheme reported counts as light                                                                               |
| `prefers-reduced-motion: reduce \| no-preference` | Against the system setting (`AccessibilityInfo`); see the first render below                                                                                     |
| `and`, a comma list                               | `and` joins features; a comma list matches when one of its queries does                                                                                          |
| `not`, `only`, `screen`, `all`                    | `not` in front negates its query; `only`, `screen` and `all` are accepted and change nothing                                                                     |
| Lengths                                           | `px` or no unit (one pixel is one density-independent pixel); `rem` and `em` are `remBase` times their number                                                    |

Anything else never matches and is warned about in development, with a message that names it: another feature (`hover`, `pointer`, `resolution`), another media type (`print`), another unit (`vw`, `%`), a feature with no value (`(hover)`), and text that is not a query (`or`, nested parentheses). `@container` and `@supports` keys are dropped as other at-rules are.

A query is read once for each text and remembered, wherever it is written.

### The order

The blocks that match are merged over every plain key of the same style object, in the order the blocks are written: a later block wins over an earlier one, and a plain key wins over none of them, even one written after the block. That is what the web does: the base rule of the object comes first in the style sheet and each nested media rule after it, with the same specificity. `when()` and `whenScheme()` blocks take their turn in the same order.

```tsx
const style = {
  padding: 1,
  '@media (min-width: 600px)': { padding: 2, margin: 2 },
  margin: 1,
  '@media (min-width: 500px)': { margin: 3, opacity: 0.5 },
  opacity: 1,
}
```

This style resolves to `{ padding: 1, margin: 1, opacity: 1 }` at a width of 400, to `{ padding: 1, margin: 3, opacity: 0.5 }` at 550, and to `{ padding: 2, margin: 3, opacity: 0.5 }` at 700.

A block in the `native` part of a shared style, a block inside another block, and a block inside a `when()` block are evaluated too. The values inside a block are converted as any value is (`'8px'` is `8`), with the same warnings. Each style given to `styled` is its own entry of the style array, so a later style wins over an earlier one, its media blocks included.

### What is cached and what renders again

- **Object styles of `styled`** with media keys and no condition key: their queries are read when the component is made, and the style is resolved and registered with the platform once for each set of matching queries, then reused.
- **A function style** runs on each render, as before; its media keys are evaluated against the window of that render. Its queries are read once for each text.
- **`StyleSheet.create(function)`**: once for each theme object and each set of matching queries. An entry that has a `when()` or `whenScheme()` key is resolved on each render, against the providers and the window.
- **`StyleSheet.create(object)`** has no hook to read the window: its media blocks are dropped, as its `when()` blocks are. Use a function.

The binding listens to the platform once, for every component: the window size (`Dimensions`), the color scheme (`Appearance`) and reduced motion (`AccessibilityInfo`), while at least one component listens. A component renders again when the set of its matching queries changes, not on every change of the width: a component with a `min-width: 600px` block renders again when the width crosses 600, and not while it moves from 400 to 599. A component whose styles have no media key (and no `whenScheme()` key that the system decides) subscribes to nothing.

`whenScheme()` with no provider that has a `colorScheme` above, and `prefers-color-scheme`, both read the system color scheme, and a change of the system setting renders again the components that use either. Below a provider with a `colorScheme`, `whenScheme()` follows the provider and does not render again; `prefers-color-scheme` follows the system there too, as on the web, where the media query reads the system and `whenScheme()` reads the theme.

### Reduced motion on the first render

The platform answers `isReduceMotionEnabled()` asynchronously. Until it answers, `prefers-reduced-motion` is `no-preference`, the platform's default and what a system with no setting reports; the answer is asked for when the first component that listens mounts, and when it is `reduce` those components render again. Later mounts read the last answer at once.

### `useMediaQuery`

```tsx
const isWide = useMediaQuery('(min-width: 600px)', { defaultMatches: false })
```

`useMediaQuery(query, options?)` is for what a style cannot do: render one structure or another. It takes the query as `matchMedia` does, with or without `@media`, uses the same parser and the same subscription as the styles, and renders again only when its answer changes. A query it cannot evaluate is `false`, with a development warning. A `rem` length in it is the `remBase` of `configure` (default 16). `defaultMatches` (default `false`) is the answer of a render to a string; there is no server on React Native, and the option is there so that one call runs on both platforms.

The React binding has the same hook, `useMediaQuery(query, { defaultMatches })`, on `window.matchMedia`. On the server, and in the first render of a hydration, it is `defaultMatches`, so that the HTML of the server and the hydration agree; the browser's answer follows at once. It uses a hook, so it is a client export only: the server-components build does not have it.

## Interaction states

A `state()` key ([Writing styles](writing-styles.md#interaction-states)) is a condition here, evaluated on each render of the component against what it is doing. Its part is merged over the plain keys in the order it is written, as a `when()` part or a media block is, and it nests in them, and they in it.

```tsx
import { Pressable } from 'react-native'
import { at, createStyle, state } from '@umber-style/react-native'

const { styled } = createStyle({ palette: { primary: '#0000ff' } })

const Button = styled(Pressable)({
  opacity: 1,
  ...at(state('pressed'), { opacity: 0.7 }),
  ...at(state('disabled'), { opacity: 0.4 }),
})
```

`<Button />` gives `Pressable` a `style` function. The platform calls it with `{ pressed }`: it returns `[{ opacity: 1 }]`, `[{ opacity: 0.7 }]` while a finger is down, and `[{ opacity: 0.4 }]` for `<Button disabled />`, which the platform never presses (`packages/react-native/src/states.test.tsx`).

### How each state is learned

| State      | Learned from                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pressed`  | A `Pressable`: its own state. The binding gives it `style` as a function, `({ pressed }) => styles`, and the platform calls it. Any other component: the `pressed` prop                                                                                              |
| `disabled` | The props: `disabled`, `aria-disabled` or `accessibilityState.disabled` is `true`, or `editable` is `false`. They are still forwarded. `editable={false}` is how a `TextInput` takes no input, and it does not set the accessibility state, so it is read on its own |
| `hovered`  | `onHoverIn` and `onHoverOut`, kept as state by the binding, for a component whose object styles name `hovered`; and the `hovered` prop                                                                                                                               |
| `focused`  | `onFocus` and `onBlur`, kept the same way, for a component whose object styles name `focused`; and the `focused` prop. It is any focus: the focus event says nothing of how focus arrived                                                                            |

**`pressed` on a `Pressable`.** `Pressable` renders again on a press only when its `style` or its `children` is a function (`Pressable.js`, `shouldUpdatePressed`), so the binding passes a function only to a `Pressable` whose styles name `pressed`. One whose styles name no state, or only `disabled`, keeps getting an array, and a press does not render it: in the tests a pressable with a state key renders 3 times for mount, press in and press out, and one without renders once. A `style` prop of yours that is a function is called with the same `{ pressed }`, and its result comes after the styles.

**Which component is a `Pressable`.** The platform's `Pressable` itself, given to `styled` or as `as`, and nothing else: the binding compares the component with it. A component that cannot read a function `style` is never given one. A component of your own that wraps `Pressable`, and `styled` of a styled `Pressable`, are not recognized: style the `Pressable` itself, or pass `pressed`.

**A component that reports no state** (a `View`, a touchable, your own) is told it by its props:

```tsx
const Card = styled(View)({
  opacity: 1,
  ...at(state('pressed'), { opacity: 0.7 }),
  ...at(state('focused'), { borderWidth: 2 }),
})

// <Card />          [{ opacity: 1 }]
// <Card pressed />  [{ opacity: 0.7 }]
// <Card focused />  [{ opacity: 1, borderWidth: 2 }]
```

Where the styles name a state, `pressed`, `hovered` and `focused` are the binding's: they do not reach the component, unless `shouldForwardProp` returns `true` for the name (a component that takes `pressed` itself). Where the styles name no state they are forwarded as any prop, as before. The props are typed on every styled component (`StateProps`). On the web the props are not read: the selectors decide.

**Hover and focus kept as state.** A component whose object styles name `hovered` or `focused` keeps them in one React state and gives the component `onHoverIn` and `onHoverOut`, or `onFocus` and `onBlur`, for the states it names; your own handlers of those names are still called, with the event. A component that names neither keeps no state and adds no handler.

**A state in a function style.** The binding chooses which hooks a component calls when the component is made, from the keys of its object styles; a key that a function style returns is known only after the function ran. `pressed` and `disabled` need no hook, so they work in a function style, also one that names a state on one render and not the next. `hovered` and `focused` need the state above: name the key in an object style of the component as well, an empty part is enough (`{ ...at(state('focused'), {}) }`). Without it, a function style's `hovered` or `focused` follows the prop of that name alone, with a development warning. So the hooks of every component that names no state stay as they were.

### The timing of `pressed`

`pressed` is what `Pressable` reports, and it differs from the web's `:active` in two ways:

- `Pressable` keeps `pressed` for at least 130 milliseconds after a press in, so a quick tap shows the pressed look for that long (`Pressability.js`, `DEFAULT_MIN_PRESS_DURATION`).
- `pressed` turns false when the finger leaves the press area (the view and its `pressRetentionOffset`) while it is still down; the web's `:active` holds until the button of the pointer is let go.

### What it costs

`packages/react-native/bench/states-pressables.bench.ts` renders 48 pressables of one look (every fourth disabled) with no state key, with the state keys, and with the same look written by hand as a `style` function on the platform `Pressable`, and calls the `style` function as a press does.

| Case                                                                | Average  | Allocated |
| ------------------------------------------------------------------- | -------- | --------- |
| 48 pressables, no state key (a style array)                         | 48.15 us | 125.18 KB |
| 48 pressables, state keys (a `style` function)                      | 61.57 us | 164 B     |
| 48 pressables, the same look as an own `style` function, no binding | 13.39 us | 105 B     |
| One press, state keys                                               | 466 ns   | 113 B     |
| One press, the own `style` function                                 | 2 ns     | 0 B       |

Measured on 0.8.0 with `pnpm bench react-native states --rounds 3` in the soroush-bench Docker sandbox (the median of three rounds): read the ratios, not the times, and an allocation under about 1 KB as noise. A pressable with state keys costs about 1.3 times one without on a render: its state parts are resolved once for each combination of the theme, the color scheme of the provider, the matching queries and the states, and the same object is given again after (resolved on each render, as they were first written, it was 2.5 times); a press looks up the style resolved for its states (466 ns), where a hand-written function over registered entries only picks one. The binding's cost against no binding at all (the third row) is that of `styled` itself, with or without state keys.

## Animations

The `animation*` and `transition*` keys of a style run on React Native through react-native-reanimated, from an entry of their own: `@umber-style/react-native/animated` (`umber-style/react-native/animated`). Without that entry they are dropped, as they always were, with a development warning, and the app loads nothing of it.

### Installing the library

```sh
npx expo install react-native-reanimated react-native-worklets   # in an Expo app
npm install react-native-reanimated@~4.8.0 react-native-worklets@~0.14.0   # elsewhere (or ~4.7.0 and ~0.13.0)
```

The library and its worklets runtime are optional peer dependencies of `@umber-style/react-native`: `react-native-reanimated` `~4.7.0 || ~4.8.0` and `react-native-worklets` `~0.13.0 || ~0.14.0`. Each release of the library goes with one minor of the runtime and three minors of React Native, from its own `package.json`:

| react-native-reanimated | react-native-worklets  | React Native |
| ----------------------- | ---------------------- | ------------ |
| 4.7.x (4.7.1 tested)    | 0.13.x (0.13.0 tested) | 0.86 to 0.88 |
| 4.8.x (4.8.0 tested)    | 0.14.x (0.14.0 tested) | 0.87 to 0.89 |

The binding without the entry keeps its own range, `react-native` `>=0.76.0`. Set up the library as its documentation says (the Babel plugin of the worklets runtime; Expo's preset adds it). Expo Go for SDK 58 carries 4.7.1 and 0.13.0, which is what `npx expo install` chooses there, inside the range. The whole test set of the binding passed against 4.7.1 and 0.13.0 as it does against 4.8.0 and 0.14.0; the repository's tests run against 4.8.0.

### Turning it on

The entry exports one value, `animated`. Give it to `createStyle` or to `configure`:

```tsx
import { createStyle } from '@umber-style/react-native'
import { animated } from '@umber-style/react-native/animated'

const { styled, keyframes } = createStyle(theme, { animated })
// or, for the default style, before it is used: configure({ theme, animated })
```

It is a value given to a call, never an import done for its side effect: a bundler drops an import whose value is not used from a package marked `"sideEffects": false`.

One style module for both platforms passes it through a file the bundler picks for each platform. The shared `createStyle` and `configure` of `umber-style/react` take `animated`, and the web accepts it and ignores it, so the module type-checks once. From the example app this was checked in (`host.native.tsx` is Metro's pick on iOS and Android, `host.tsx` on the web):

```tsx
// host.native.tsx
import { animated } from 'umber-style/react-native/animated'
export const styleOptions = { animated }

// host.tsx
export const styleOptions = { prefix: 'umber' }

// style.ts
import { createStyle } from 'umber-style/react'
import { styleOptions } from './host'
export const { styled, ThemeProvider, keyframes } = createStyle(lightTheme, styleOptions)
```

The web bundle of that app holds no module of the library or of the entry.

### An example

From the repository's test of one source on both platforms (`sharedAnimation.test.tsx`):

```tsx
const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })
const skeleton: SharedStyleObject = {
  opacity: 1,
  animation: `${pulse} 1.5s ease-in-out infinite`,
}
```

A styled `View` with `skeleton`: on the web its class is `{opacity:1;animation:pulse-... 1.5s ease-in-out infinite;}` with its `@keyframes` rule. On React Native, with the entry, `View` is rendered as the library's animated form of it, and gets:

```ts
[
  {
    opacity: 1,
    animationName: /* the rule of css.keyframes for { '0%': { opacity: 1 }, '100%': { opacity: 1 }, '50%': { opacity: 0.4 } } */,
    animationDuration: 1500,
    animationTimingFunction: 'ease-in-out',
    animationDelay: 0,
    animationIterationCount: 'infinite',
    animationDirection: 'normal',
    animationFillMode: 'none',
    animationPlayState: 'running',
  },
]
```

The animation and transition keys are in `NativeStyleObject` and so in the shared style types: write them in the shared part of a style. The `web` part is still read on the web only.

### What is translated

The library takes the words of CSS in forms of its own. The entry turns what a style for the web writes into them, read in the source of 4.7.1 and of 4.8.0, which agree on every row but the transform:

| A style writes                                                                                                                        | 4.7.1 and 4.8.0 take                                                                                                                                                                                       | The entry gives                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animationName: pulse` (a name of `keyframes`)                                                                                        | the steps object, or a rule of `css.keyframes`; a string is left out without a word                                                                                                                        | the rule of `css.keyframes` for the steps of the name, the same object each time the name is used. `none` stops the animation; a name `keyframes` did not return runs nothing, with a warning                                                               |
| `'1.5s'`, `'300ms'`, a number                                                                                                         | the three, text only in lower case and without an exponent                                                                                                                                                 | a number of milliseconds: `1500`, `300`; `'.5S'` and `'1e3ms'` are read too. A negative duration is dropped                                                                                                                                                 |
| `'ease-in-out'` and the six other named easings                                                                                       | the same seven names                                                                                                                                                                                       | the name                                                                                                                                                                                                                                                    |
| `'cubic-bezier(0.25, -0.5, 0.75, 1.5)'`, `'steps(4, jump-start)'`                                                                     | throws for the text in a longhand                                                                                                                                                                          | the library's `cubicBezier(...)` and `steps(...)`. Text CSS rejects (an x outside 0 to 1, a count that is not a whole number of 1 or more, `jump-none` with one step) is dropped, with a warning, and the library's default, `ease`, applies, as on the web |
| `animationIterationCount: 'infinite'` or `'2'`, `animationDirection`, `animationFillMode`, `animationPlayState`, `transitionBehavior` | the keywords of CSS; another value throws                                                                                                                                                                  | the keyword in lower case, the count as a number; another value is dropped, with a warning                                                                                                                                                                  |
| `transitionProperty: 'background-color, opacity'`                                                                                     | the names of style keys                                                                                                                                                                                    | `['backgroundColor', 'opacity']`; `all` and `none` (alone) as they are                                                                                                                                                                                      |
| a list (`'1s, 2s'`)                                                                                                                   | a list                                                                                                                                                                                                     | a list, item by item                                                                                                                                                                                                                                        |
| `transform: 'translateX(-8px) rotate(45deg)'` in a step                                                                               | text, each number read with `parseFloat`, so `px` is taken off by the library; an angle needs `deg` or `rad`. Text it cannot read throws in 4.7 and is ignored with a warning in 4.8; `none` throws in 4.7 | the text as it is when the library reads every function of it; `none` as no transform (`[]`); other text dropped from the step, with a warning                                                                                                              |
| a step                                                                                                                                | a native style keyed by offset                                                                                                                                                                             | `from` and `to` as `0%` and `100%`, a comma list split, each step turned into a native style as a style is (`'1rem'` is `16`), a key the library does not animate dropped with a warning                                                                    |

A value that is not valid is dropped where it is written, so the value of an earlier key, or of the level below a state or media part, stays: the web keeps an earlier rule when a later declaration is not valid. Each text is read once for each component and remembered.

### The shorthands

`animation` and `transition` are expanded into their longhands as CSS expands them: every longhand is set, the parts not given to their initial values (`0s`, `ease`, `1`, `normal`, `none`, `running`; for `transition`, `all`), and a later key of the same style wins over an earlier one, shorthand or longhand. In one item, the first time is the duration and the second the delay; a name that `keyframes` returned is the name; a keyword of a part already set is read as the name, as CSS reads it. A part that cannot be read (`pulse 1s 2s 3s`, `opacity color 1s`, `none` among several transitions) drops the whole shorthand, with a warning, as the web drops it.

### Transitions and state keys

A transition runs when a style changes: a state key, a theme, a prop. From the tests (`animated.test.tsx`):

```tsx
const { styled } = createStyle(theme, { animated })
const Button = styled(Pressable)({
  opacity: 1,
  transitionProperty: 'opacity',
  transitionDuration: '150ms',
  ...at(state('pressed'), { opacity: 0.7 }),
})
```

`<Button testID="save" />` gives the animated `Pressable` `[{ opacity: 1, transitionProperty: 'opacity', transitionDuration: 150 }]`; while a finger is down, `[{ opacity: 0.7, transitionProperty: 'opacity', transitionDuration: 150 }]`, and the library animates the opacity between them. The animated component reads its style as a list and cannot call a function `style`, so a component whose object styles animate and name `pressed` keeps the press itself, from `onPressIn` and `onPressOut` (your own handlers of those names are still called), instead of the function `style` that a `Pressable` gets without the entry.

### Which components are wrapped

A styled component is rendered as the library's animated form of its component (`createAnimatedComponent`, made once for each component, `as` included) only when its styles animate:

- **An object style** with an animation or transition key, at any depth but the `web` part: from the start.
- **A function style** that returns one: from the first render in which it does, and from then on for every instance of that component; an instance mounted before then mounts again once, because its element changes, and a development warning says so. Name an animation or transition key in an object style as well (`transitionProperty` is enough) to wrap it from the start. A wrapped component whose function style stops animating stays wrapped, and the library stops the animation.

A component whose styles never animate is the component it is without the entry: the same hooks, the same element, no wrapper. The hooks of a component do not change between renders either way.

### Reduced motion

The library's CSS path does not ask the system for reduced motion. The entry does, through the binding's own state (`AccessibilityInfo`, as for `prefers-reduced-motion` in a media query): a component that animates renders again when the setting changes, and while the user asks for less motion:

- **no animation starts**: the view shows its own style. An infinite animation stays at the style without the animation. A finite animation whose `animationFillMode` is `forwards` or `both` shows the step it would end on (the last step, or the first for a reversed or evenly alternating one), so that an entrance whose own style is the start (`opacity: 0`) is not left there; with `none` or `backwards` the view shows its own style;
- **no transition runs**: a change of style jumps to its end.

The setting is read asynchronously, so a component may render once with motion before the platform answers (see [Reduced motion on the first render](#reduced-motion-on-the-first-render)). To see it on a device: on iOS, Settings, Accessibility, Motion, Reduce Motion; on Android, Settings, Accessibility, Remove animations (the name varies by maker: Color and motion, Visibility enhancements).

### What runs on both platforms

With the entry, these run on the web and on React Native from one style: opacity, transforms (`translate`, `scale`, `rotate`, `skew`, `matrix`, `perspective`, in `px`, unitless, `deg` or `rad`), colours, sizes, margins and paddings, positions, borders and their widths, radii, shadows (`shadowColor`, `shadowOffset`, `shadowOpacity` and `shadowRadius` on iOS, `elevation` on Android, `boxShadow`), with keyframes, easing (the named easings, `cubic-bezier()`, `steps()`), duration, delay, direction, iteration count, fill mode and play state, and transitions of those properties.

What stays web-only: `linear()` easings, `animation-timeline`, `animation-composition` and `animation-range`, a step or a transition of a property the platform does not have or the library does not animate (`background`, `boxSizing`), lengths in `em` or a viewport unit, `rotate(1turn)` and other units the library's transform parser does not read, and the global CSS of `Global`. A discrete property (`display`, `flexDirection`) changes at once rather than in between, as the library's documentation says.

### What it costs

`packages/react-native/bench/animations.bench.ts` renders 48 views of one look to a string, over a stand-in of the library whose `createAnimatedComponent` returns the component itself (as the library's mock does), so what the library does on a device is not in it.

| Case                                                     | Average   | Allocated |
| -------------------------------------------------------- | --------- | --------- |
| 48 views, no animation                                   | 39.21 us  | 110.01 KB |
| 48 views, no animation, with the entry                   | 38.95 us  | 117 B     |
| 48 views, a skeleton animation, no entry (keys dropped)  | 38.27 us  | 118 B     |
| 48 views, a skeleton animation, with the entry           | 40.23 us  | 116.61 KB |
| 48 views, a function style that animates, no entry       | 95.33 us  | 186.96 KB |
| 48 views, a function style that animates, with the entry | 149.22 us | 284.90 KB |

Measured on 0.8.0 with `pnpm bench react-native animations --rounds 3` in the soroush-bench Docker sandbox (the median of three rounds): read the ratios, not the times. The allocation is an estimate from the heap: the first row allocated 110 B in the run this table showed before and 110.01 KB in this one, so read the first four rows of that column as noise. A component that does not animate costs the same with the entry as without it. One whose object style animates costs about as much as one that does not, its style translated once when the component is made; it watches reduced motion with the hook of the media keys. A function style that animates is resolved and translated on each render, about 1.6 times the same function style without the entry.

### Development warnings of the entry

Once for each distinct message, with the component's name, in development only:

- a value that is not valid: `Pulse: "animationDuration: -1s" is not valid: it is dropped, as the web drops it. Write a time of 0 or more, such as 1.5s or 300ms.`;
- a shorthand with a part it cannot read: `Pulse: "animation" cannot read "3s": the whole animation is dropped, as the web drops it.`;
- a name that `keyframes` did not return: `Pulse: "animationName: spin" is not a name that keyframes returned, so no animation runs for it. Give the name keyframes returns.`;
- a key the library does not run: `Pulse: "animationTimeline" is not run by the animation library on React Native; it is dropped.`;
- a property in a step that the library does not animate: `Pulse: "boxSizing" in the step "100%" is not animated by the animation library on React Native; it is dropped from the step.`, and an animation key other than `animationTimingFunction` in a step;
- a function style that starts an animation in a component whose object styles name none (see [Which components are wrapped](#which-components-are-wrapped)).

## Handles of a sheet of the theme

A styled component takes a handle of a sheet made from a function of the theme in `style`, as on the web ([Style sheets](style-sheets.md#a-sheet-of-the-theme-without-a-hook)). From `packages/react-native/src/themedStyle.test.tsx`:

```tsx
const wide: string = '@media (min-width: 600px)'

const sheet = StyleSheet.create((theme) => ({
  card: { padding: theme.space[1], [wide]: { padding: theme.space[2] } },
}))

const Card = styled(View)()

const Screen = () => <Card style={sheet.card} />
```

The component renders through a small inner component when its `style` holds a handle: that component reads the theme and the providers once, as `useStyle` does, subscribes to the window and the system color scheme for the media and `whenScheme()` keys of the handles' sheets with the same path `useStyle` takes, and renders the styled component again with each handle replaced by the registered style object `useStyle(sheet)` gives. A static component given `style={sheet.card}` therefore follows a rotation: in the test, `padding` is `4` at 400 by 800, `8` after a resize to 800 by 400, and `4` again after the window turns back. A component given no handle is unchanged and pays one check of its `style`.

A plain `View` cannot resolve a handle: it is a type error, and the `TypeError` of a plain element when the platform reads the keys of its `style`. `apply`, `css()` and the styles of `styled` throw for one too; read the entry with `useStyle(sheet)` there. `JSON.stringify(sheet.card)` throws the same error.

For a component that types its `style` as entries only, `SheetStyleProp<S>` takes the entries of the binding and handles, and rejects a plain object and a style of the platform's own `StyleSheet.create` ([Typed styles](typed-styles.md#sheet-entries-only)). The entries of the binding carry a mark for the compiler, `NativeSheetEntry`, which does not exist at run time.

## Class components: `withTheme` and `withStyle`

`withTheme(Component)` renders `Component` with `theme` set to `useTheme()`, and `withStyle(sheet)(Component)` with `styles` set to `useStyle(sheet)`, as on the web ([React](react.md#class-components-withtheme-and-withstyle)): the wrapper is a function component that calls the hook, so a class component gets what a hook gives. From `packages/react-native/src/wrappers.types.test.tsx`, which compiles it and renders it:

```tsx
import { Component } from 'react'
import { Text, View } from 'react-native'
import { createStyle, type NativeSheetEntry, type NativeTheme } from '@umber-style/react-native'

const lightTheme = { palette: { primary: '#1b5fd1', surface: '#ffffff' }, space: [0, 4, 8, 16] }

const { StyleSheet, withStyle, withTheme } = createStyle(lightTheme)

const sheet = StyleSheet.create((theme) => ({
  card: { padding: theme.space[3], backgroundColor: theme.palette.surface },
  title: { color: theme.palette.primary },
}))

interface CardProps {
  title: string
  theme: NativeTheme<typeof lightTheme>
  styles: { card: NativeSheetEntry; title: NativeSheetEntry }
}

class Card extends Component<CardProps> {
  static variant = 'outlined'

  render() {
    const { title, theme, styles } = this.props
    return (
      <View style={styles.card}>
        <Text style={[styles.title, { borderColor: theme.palette.primary }]}>{title}</Text>
      </View>
    )
  }
}

// The props of Card without theme and styles, its ref, and its statics.
export const ThemedCard = withTheme(withStyle(sheet)(Card))
```

- `theme` is the real theme of the nearest provider, with the lengths as numbers (`NativeTheme<T>`), as `useTheme()` gives it.
- `styles` holds the registered style objects that `useStyle(sheet)` gives, the same objects. Since the wrapper calls `useStyle`, it follows what the hook follows: the providers for a `when()` key, the window for a media key and the system color scheme for a `whenScheme()` key. In `packages/react-native/src/createWrappers.test.tsx` a class component given `withStyle` of a sheet with a media key, a `when()` key and a `whenScheme()` key gets `{ padding: 2 }` under the dark provider at 400 by 800, `{ padding: 4 }` after a resize to 800 by 400, and the margin of its `whenScheme('dark')` key once the system turns dark.
- The wrapper takes the props of the component without `theme` (or `styles`), forwards `ref` (React 19: a prop), keeps the statics that are not React's own, and is named `withTheme(Card)` or `withStyle(Card)`. The types are those of the web: a `theme` or `styles` prop on the wrapper, a component whose `theme` is of another type, and a `styles` that names an entry the sheet does not have are type errors.

## Development warnings

In development, once for each distinct message, the binding warns with `console.warn`. A message starts with `@umber-style/react-native:` and the name of the component when it is known: the `name` option of `styled`, else the display name or function name of the wrapped component; for a sheet, `sheet entry "card"`. Nothing is warned in production, or where there is no `process`.

- **A key it drops by mistake:** a selector (`&:hover`, `:focus`), an at-rule (`@supports ...`), a media query with something the binding does not evaluate (the message names it: `React Native does not evaluate the media feature "hover"`), a custom property (`--accent`), written outside the `web` part of a style. Without the animated entry, an `animation*` or `transition*` key is dropped too, with a message that says how to turn the entry on: `Pulse: "animation" is dropped: the animated entry is not on, so animations and transitions do not run. With react-native-reanimated installed, import { animated } from '@umber-style/react-native/animated' and pass it: createStyle(theme, { animated }) or configure({ animated }).` For example `Named: "&:hover" is dropped: React Native has no selectors. A key for the web only goes in the web part of a shared style.`
- **A query `useMediaQuery` cannot evaluate:** `useMediaQuery("(hover: hover)") is false: React Native does not evaluate the media feature "hover".`
- **A state that a function style names and the component does not keep:** `Card: state('focused') is named in a function style only, so the component keeps no focused state and follows the focused prop alone. Name it in an object style of the component as well (an empty part is enough) for the binding to follow onFocus and onBlur.`
- **Never warned:** `label`, anything inside the `web` part, a `when()`, `whenScheme()` or `state()` key that does not match (a condition, not a web-only key), and a media query that is evaluated and does not match. A selector key for a state (`&:active`) is still warned about as a selector.
- **A value it cannot convert:** a shorthand with several values (`padding: '10px 20px'`), `em`, a viewport unit (`vh`, `vw`, `vmin`, `vmax` and their `s`, `l` and `d` forms), a `calc(...)`, `currentColor` in any case, and another CSS unit where no number is taken. The value is passed as it is.

## Arithmetic and `alpha`

The package exports `add`, `subtract`, `multiply`, `divide`, `negate` and `alpha`. Arithmetic returns real numbers, and a percentage stays a percentage; anything that cannot be computed throws. `alpha(color, opacity)` checks its arguments as the web `alpha` does, returns the colour for `1` and `'transparent'` for `0`, and between them `rgba(r, g, b, a)` for a colour it can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with numbers); any other colour is returned as it is. The package also exports `at`, for the `web` part of a shared style. See [Tokens](tokens.md).

## One source for both platforms

`umber-style/react` is the same API, typed for both platforms, and resolves to this binding under the `react-native` export condition: see [Style sheets and the style prop](style-sheets.md).

`CacheProvider` exists so that one source compiles for both platforms: it renders its children, and its `value` is not read.

## Limits

- `useStyleValue` of the web bindings is not exported here: React Native has no CSS variable, and its form on the platform waits for the animations of the platform (a later task). See [Writing styles](writing-styles.md#a-value-that-changes-without-a-render).
- **The React Native binding has run in a real app on iOS only:** an Expo example on an iPhone in Expo Go (a theme switch and a nested theme changing what is drawn, `pressed` and `disabled`, the animated entry with reduced motion); Android has not been observed. The tests alias the one import of the platform (`react-native`) to a stand-in whose `StyleSheet.create` returns its input and whose `Appearance` is a stub, and they use plain host components that record their props. The styles were compiled against the real `react-native` types.
- Because of that, `StyleSheet.create` returning ids and the platform's own handling of an unknown key were not exercised. The events of `Dimensions`, `Appearance` and `AccessibilityInfo` were sent by stand-ins: a rotation and a window resize on a device were not observed.
- The color scheme of the platform is read when a component renders. A change of the system setting renders again the components that read it through `prefers-color-scheme` or a `whenScheme()` key that no provider decides; a style function that reads `Appearance` itself is not rendered again.
- That `withStyle` follows a rotation and the color scheme was checked with the stand-ins of `Dimensions` and `Appearance`, not on a device.
- A styled component whose `style` switches between holding a handle and not mounts its element again: the inner component that resolves handles comes and goes. A handle inside a function `style` (a `Pressable`) is not seen. That a handle follows a rotation was checked with the stand-in of `Dimensions`, not on a device.
- Sheets made from a function are registered once for each theme object, kept in a `WeakMap`, so they are released with the theme object. A theme object that is re-created on every render registers a new sheet every time.
- `alpha` cannot mix a colour it cannot read as a literal (a named colour, `hsl()`): it returns that colour unchanged.
- That a modal's content shows the theme of the nested provider above it was checked with a stand-in modal that renders its children in place, as React Native's does; the platform's `Modal` was not run.
- The conversion of values with CSS units and the development warnings were checked with the same stand-ins, not on a device: that the platform lays out the converted numbers as the web lays out the lengths was not observed.
- `em` and the viewport units are not converted, and a literal `calc(...)` is not computed: each is passed as it is, with a warning.
- A theme is converted once for each theme object: a `theme` object re-created on every render is converted every time. Only the keys of `lengthKeys` are converted; `NativeTheme<T>` types the default ones, so with another `lengthKeys` the types do not follow.
- A unitless `lineHeight` is a factor on the web and a number of points on React Native; `lineHeight: '1.5'` becomes `1.5`, which is not what the web shows.
- **The animated entry was seen on an iPhone only.** In the example app (Expo SDK 58, in Expo Go, with react-native-reanimated 4.7.1 and react-native-worklets 0.13.0), two skeleton bars with `keyframes` and an infinite `animation` pulsed; a button with `state('pressed')` and a transition on opacity faded while held and came back on release; with the system's reduced motion on, nothing animated. Android was bundled (`npx expo export`, exit code 0), not run on a device. The tests run the entry over the library's official mock (`react-native-reanimated/mock`), whose `createAnimatedComponent` returns the component itself and which runs no animation, so they check what the entry gives the library, not what the library draws.
- The repository's tests run against react-native-reanimated 4.8.0 and react-native-worklets 0.14.0; the run against 4.7.1 and 0.13.0 was made once, by installing them in place of the newer ones. 4.7 does not animate five properties that 4.8 does (`borderCurve`, `experimental_backgroundImage`, `verticalAlign`, `writingDirection`, `objectFit`): with 4.7 they are dropped from a step by the library without a warning.
- Steps given to `keyframes` as a function of the theme are resolved against the base theme of the styling, once: a provider does not change them, as the raw values of steps on the web come from the base theme.
- Only a styled component is wrapped and watches reduced motion. A sheet entry with animation keys (`useStyle`, `StyleSheet.create`) is translated, but it animates only on a component the library animates, and reduced motion is not applied to it.
- A component that starts animating only through a function style mounts again once, when it starts; a `Pressable` that animates only through a function style, or that is given a function `style` prop while it animates, does not report its press to the binding (its `pressed` follows the prop).
- `linear(...)` easings are not read (dropped with a warning). `none` in a list of animation names is left out, so the other lists no longer line up with the names after it.
- The list of properties the library animates (`ANIMATED_KEYS` in `packages/react-native/src/motionSteps.ts`) is copied from 4.8.0; a property it adds later is dropped from a step until the list follows.
- A transform written as text is checked in a step only: in the plain style of a component that animates it is passed as it is, and 4.7 throws for text it cannot read.
- **The state keys were seen on an iPhone for `pressed` and `disabled` only.** In the example app in Expo Go, a button built on `Pressable` faded while held and a disabled one stayed faint. The tests use a stand-in `Pressable` with the contract of `Pressable.js` of React Native 0.88.1 (its state, `shouldUpdatePressed`, the function `style`, `memo`), which does not model Pressability's timing (the 130 ms, the press area). Android, hover with the pointer-event flag on, focus with a hardware keyboard on Android, and full keyboard access on iOS were not observed.
- `hovered` does nothing on a default iOS or Android build: React Native does not call `onHoverIn` there (`Pressability.js`: the mouse handlers are `null` on both, and the pointer-event path is behind a flag that is off by default). It applies where the platform reports hover: a desktop or web target, or an app that turns the flag on.
- `focused` is any focus, keyboard or touch. A focus ring for keyboard users is the web's `outline`; on React Native there is no way to draw one for the keyboard only.
- A state part is resolved on each render, and on each call of the `style` function by the platform; it is not registered with the platform `StyleSheet`.
- A state key in a sheet entry (`StyleSheet.create`) or in `css()` never applies on React Native: an entry belongs to no component. It is dropped without a warning. On the web the same entry's state rules apply.
- Hover and focus kept from events start false: a component focused before its first `onFocus` reaches the binding (`autoFocus`) is not seen as focused until the next event.
- A `style` prop that is a function is composed only on a component whose styles name a state; on another it is put in the style list as it is, as before.
- Media queries: only the subset in [What is evaluated](#what-is-evaluated); anything else never matches. A query with one part the binding does not evaluate is dropped whole, also when another query of its comma list would match on the web (`print, (min-width: 1px)`).
- `prefers-reduced-motion` is `no-preference` until the platform answers, so a component that reads it may render once with motion before it renders without.
- `em` in a query is `remBase` times its number, as `rem` is: on the web a media query's `em` is the browser's initial font size, which `remBase` stands for. A length with no unit is read as pixels; on the web a length with no unit other than `0` makes the query invalid.
- A media key in an object literal given to `styled` or `StyleSheet.create` must be computed: the native style type has no literal at-rule key.
- The parsers of `@soroush.tech/styled-system` write the range form, which is evaluated; their output was not run through the React Native binding in a test.
- A function style's results are not remembered: its blocks are resolved on each render, as the rest of it is. A sheet entry with a `when()` or `whenScheme()` key is resolved on each render too.
- The resolved styles are kept for each set of matching queries for the life of the component type or of the theme object, with no limit: a component with many queries whose answers change independently keeps one style for each combination it meets.
