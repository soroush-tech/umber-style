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
| Object styles                    | Registered once with the platform `StyleSheet`, when the component is made                                                                                                                                                                                                                                                                                                                         |
| `StyleSheet`                     | The platform's `StyleSheet`, with a `create` that resolves a function of the theme and registers the styles                                                                                                                                                                                                                                                                                        |
| `StyleSheet.create(object)`      | The registered styles themselves, usable at once, with no hook and no theme. Registered with the platform once, when the first key is read. A `when()` or `whenScheme()` key is dropped: use a function, which is resolved against the providers                                                                                                                                                   |
| `useStyle(sheet)`                | Returns style objects. Sheets made from a function are registered once for each theme object; an object sheet is returned as it is                                                                                                                                                                                                                                                                 |
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

- drops the keys that only the web has, each whole: `label`, selectors (a key with `&` or one that starts with `:`), at-rules and custom properties;
- keeps objects and arrays under any other key (`shadowOffset`, `transform`);
- merges the `native` part of a shared style over the rest and drops the `web` part;
- merges the parts of `when()` and `whenScheme()` keys that match;
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

## Development warnings

In development, once for each distinct message, the binding warns with `console.warn`. A message starts with `@umber-style/react-native:` and the name of the component when it is known: the `name` option of `styled`, else the display name or function name of the wrapped component; for a sheet, `sheet entry "card"`. Nothing is warned in production, or where there is no `process`.

- **A key it drops by mistake:** a selector (`&:hover`, `:focus`), an at-rule (`@media ...`, whose message says that media queries are not evaluated on React Native yet), a custom property (`--accent`), and an `animation*` or `transition*` key (animations do not run on React Native yet), written outside the `web` part of a style. For example `Named: "&:hover" is dropped: React Native has no selectors. A key for the web only goes in the web part of a shared style.`
- **Never warned:** `label`, anything inside the `web` part, and a `when()` or `whenScheme()` key that does not match (a condition, not a web-only key).
- **A value it cannot convert:** a shorthand with several values (`padding: '10px 20px'`), `em`, a viewport unit (`vh`, `vw`, `vmin`, `vmax` and their `s`, `l` and `d` forms), a `calc(...)`, `currentColor` in any case, and another CSS unit where no number is taken. The value is passed as it is.

## Arithmetic and `alpha`

The package exports `add`, `subtract`, `multiply`, `divide`, `negate` and `alpha`. Arithmetic returns real numbers, and a percentage stays a percentage; anything that cannot be computed throws. `alpha(color, opacity)` checks its arguments as the web `alpha` does, returns the colour for `1` and `'transparent'` for `0`, and between them `rgba(r, g, b, a)` for a colour it can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with numbers); any other colour is returned as it is. The package also exports `at`, for the `web` part of a shared style. See [Tokens](tokens.md).

## One source for both platforms

`umber-style/react` is the same API, typed for both platforms, and resolves to this binding under the `react-native` export condition: see [Style sheets and the style prop](style-sheets.md).

## Limits

- **The React Native binding was never run in a real app.** The tests alias the one import of the platform (`react-native`) to a stand-in whose `StyleSheet.create` returns its input and whose `Appearance` is a stub, and they use plain host components that record their props. The styles were compiled against the real `react-native` types.
- Because of that, `StyleSheet.create` returning ids, `Appearance` changes, and the platform's own handling of an unknown key were not exercised.
- The color scheme of the platform is read when a component renders. A change of the system setting does not re-render a component by itself.
- Sheets made from a function are registered once for each theme object, kept in a `WeakMap`, so they are released with the theme object. A theme object that is re-created on every render registers a new sheet every time.
- `alpha` cannot mix a colour it cannot read as a literal (a named colour, `hsl()`): it returns that colour unchanged.
- That a modal's content shows the theme of the nested provider above it was checked with a stand-in modal that renders its children in place, as React Native's does; the platform's `Modal` was not run.
- The conversion of values with CSS units and the development warnings were checked with the same stand-ins, not on a device: that the platform lays out the converted numbers as the web lays out the lengths was not observed.
- `em` and the viewport units are not converted, and a literal `calc(...)` is not computed: each is passed as it is, with a warning.
- A theme is converted once for each theme object: a `theme` object re-created on every render is converted every time. Only the keys of `lengthKeys` are converted; `NativeTheme<T>` types the default ones, so with another `lengthKeys` the types do not follow.
- A unitless `lineHeight` is a factor on the web and a number of points on React Native; `lineHeight: '1.5'` becomes `1.5`, which is not what the web shows.
- Media queries, interaction states and animations are not built on React Native yet; their keys are dropped with a warning. They are separate work: [#41](https://github.com/soroush-tech/umber-style/issues/41), [#42](https://github.com/soroush-tech/umber-style/issues/42) and [#43](https://github.com/soroush-tech/umber-style/issues/43).
