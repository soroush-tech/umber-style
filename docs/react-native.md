# React Native

After this page you can use the React Native binding: styled native components, sheets, the real theme values, and the parts of the API that work differently because there are no classes.

`@umber-style/react-native` needs `react` `^19.2.8` and `react-native` `>=0.76.0`. It has the same names as the React binding, over the real theme values. React Native has no CSS, so there are no variables, no classes, no cascade layers and no style element: a style is an object of the platform's own keys, and a theme value in a style function is the value itself.

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
| `styled` options                 | `shouldForwardProp` is used, and `name` names the component in the development warnings. `slot` is accepted and ignored: there are no class names                                                                                                                                                                                                                                                  |
| Forwarded props                  | Every prop but `as`, `theme` and `style`. `style` is rebuilt: the styles, then yours                                                                                                                                                                                                                                                                                                               |
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
| `useTheme()`                     | The real theme values, merged over the providers above, with the lengths as numbers. With no provider, the base theme, or an empty object when there is none: a style function then gets an empty theme                                                                                                                                                                                            |
| `createStyle` options            | Accepted so that one call runs on both platforms. `remBase` and `lengthKeys` are used (see [Values with CSS units](#values-with-css-units)); the others are not                                                                                                                                                                                                                                    |
| `configure`                      | `theme`, `remBase` and `lengthKeys` are used. Throws after first use, as on the web                                                                                                                                                                                                                                                                                                                |
| Engine                           | There is none: no `getEngine`, `engine` or `cache`                                                                                                                                                                                                                                                                                                                                                 |

The outermost provider that renders gives the base theme, as on the web, unless you set one with `configure({ theme })` or `createStyle(theme)`. A merge keeps the helper functions of a raw key (`breakpoints.up`), as on the web. The names of the web that have no meaning here (`ThemeScope`, `useThemeClass`) exist so that one source with a nested provider and portal or modal content compiles for both: see [Themes](themes.md).

## Style objects

A style is a `NativeStyleObject`. When the binding turns a style into a native style it:

- drops the keys that only the web has, each whole: `label`, selectors (a key with `&` or one that starts with `:`), at-rules other than `@media`, and custom properties;
- keeps objects and arrays under any other key (`shadowOffset`, `transform`);
- merges the `native` part of a shared style over the rest and drops the `web` part;
- merges the parts of `when()` and `whenScheme()` keys that match, and the blocks of `@media` keys that match the window: see [Media queries](#media-queries);
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

## Development warnings

In development, once for each distinct message, the binding warns with `console.warn`. A message starts with `@umber-style/react-native:` and the name of the component when it is known: the `name` option of `styled`, else the display name or function name of the wrapped component; for a sheet, `sheet entry "card"`. Nothing is warned in production, or where there is no `process`.

- **A key it drops by mistake:** a selector (`&:hover`, `:focus`), an at-rule (`@supports ...`), a media query with something the binding does not evaluate (the message names it: `React Native does not evaluate the media feature "hover"`), a custom property (`--accent`), and an `animation*` or `transition*` key (animations do not run on React Native yet), written outside the `web` part of a style. For example `Named: "&:hover" is dropped: React Native has no selectors. A key for the web only goes in the web part of a shared style.`
- **A query `useMediaQuery` cannot evaluate:** `useMediaQuery("(hover: hover)") is false: React Native does not evaluate the media feature "hover".`
- **Never warned:** `label`, anything inside the `web` part, a `when()` or `whenScheme()` key that does not match (a condition, not a web-only key), and a media query that is evaluated and does not match.
- **A value it cannot convert:** a shorthand with several values (`padding: '10px 20px'`), `em`, a viewport unit (`vh`, `vw`, `vmin`, `vmax` and their `s`, `l` and `d` forms), a `calc(...)`, `currentColor` in any case, and another CSS unit where no number is taken. The value is passed as it is.

## Arithmetic and `alpha`

The package exports `add`, `subtract`, `multiply`, `divide`, `negate` and `alpha`. Arithmetic returns real numbers, and a percentage stays a percentage; anything that cannot be computed throws. `alpha(color, opacity)` checks its arguments as the web `alpha` does, returns the colour for `1` and `'transparent'` for `0`, and between them `rgba(r, g, b, a)` for a colour it can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with numbers); any other colour is returned as it is. The package also exports `at`, for the `web` part of a shared style. See [Tokens](tokens.md).

## One source for both platforms

`umber-style/react` is the same API, typed for both platforms, and resolves to this binding under the `react-native` export condition: see [Style sheets and the style prop](style-sheets.md).

## Limits

- **The React Native binding was never run in a real app.** The tests alias the one import of the platform (`react-native`) to a stand-in whose `StyleSheet.create` returns its input and whose `Appearance` is a stub, and they use plain host components that record their props. The styles were compiled against the real `react-native` types.
- Because of that, `StyleSheet.create` returning ids and the platform's own handling of an unknown key were not exercised. The events of `Dimensions`, `Appearance` and `AccessibilityInfo` were sent by stand-ins: a rotation and a window resize on a device were not observed.
- The color scheme of the platform is read when a component renders. A change of the system setting renders again the components that read it through `prefers-color-scheme` or a `whenScheme()` key that no provider decides; a style function that reads `Appearance` itself is not rendered again.
- Sheets made from a function are registered once for each theme object, kept in a `WeakMap`, so they are released with the theme object. A theme object that is re-created on every render registers a new sheet every time.
- `alpha` cannot mix a colour it cannot read as a literal (a named colour, `hsl()`): it returns that colour unchanged.
- That a modal's content shows the theme of the nested provider above it was checked with a stand-in modal that renders its children in place, as React Native's does; the platform's `Modal` was not run.
- The conversion of values with CSS units and the development warnings were checked with the same stand-ins, not on a device: that the platform lays out the converted numbers as the web lays out the lengths was not observed.
- `em` and the viewport units are not converted, and a literal `calc(...)` is not computed: each is passed as it is, with a warning.
- A theme is converted once for each theme object: a `theme` object re-created on every render is converted every time. Only the keys of `lengthKeys` are converted; `NativeTheme<T>` types the default ones, so with another `lengthKeys` the types do not follow.
- A unitless `lineHeight` is a factor on the web and a number of points on React Native; `lineHeight: '1.5'` becomes `1.5`, which is not what the web shows.
- Interaction states and animations are not built on React Native yet; their keys are dropped with a warning. They are separate work: [#42](https://github.com/soroush-tech/umber-style/issues/42) and [#43](https://github.com/soroush-tech/umber-style/issues/43).
- Media queries: only the subset in [What is evaluated](#what-is-evaluated); anything else never matches. A query with one part the binding does not evaluate is dropped whole, also when another query of its comma list would match on the web (`print, (min-width: 1px)`).
- `prefers-reduced-motion` is `no-preference` until the platform answers, so a component that reads it may render once with motion before it renders without.
- `em` in a query is `remBase` times its number, as `rem` is: on the web a media query's `em` is the browser's initial font size, which `remBase` stands for. A length with no unit is read as pixels; on the web a length with no unit other than `0` makes the query invalid.
- A media key in an object literal given to `styled` or `StyleSheet.create` must be computed: the native style type has no literal at-rule key.
- The parsers of `@soroush.tech/styled-system` write the range form, which is evaluated; their output was not run through the React Native binding in a test.
- A function style's results are not remembered: its blocks are resolved on each render, as the rest of it is. A sheet entry with a `when()` or `whenScheme()` key is resolved on each render too.
- The resolved styles are kept for each set of matching queries for the life of the component type or of the theme object, with no limit: a component with many queries whose answers change independently keeps one style for each combination it meets.
