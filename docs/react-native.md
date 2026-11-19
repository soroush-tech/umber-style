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

| Area                  | React Native                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `styled(tag)`         | Needs a component. A string such as `'div'` throws a `TypeError`                                            |
| `styled` options      | Only `shouldForwardProp` is used. `name` and `slot` are accepted and ignored: there are no class names      |
| Forwarded props       | Every prop but `as`, `theme` and `style`. `style` is rebuilt: the styles, then yours                        |
| Style functions       | Receive the real theme: `theme.space[2]` is `8`. They run on each render                                    |
| Object styles         | Registered once with the platform `StyleSheet`, when the component is made                                  |
| `StyleSheet`          | The platform's `StyleSheet`, with a `create` that resolves a function of the theme and registers the styles |
| `useStyle(sheet)`     | Returns style objects. Sheets made from a function are registered once for each theme object                |
| `apply(...entries)`   | Returns `{ style: [...] }`: the entries that are not falsy                                                  |
| `ThemeProvider`       | Takes `theme`, `colorScheme` and `children`. `className` and `isRoot` are accepted and ignored              |
| `themeClass(...)`     | Always `''`                                                                                                 |
| `when`, `whenScheme`  | Matched at render against the nearest provider: see [Theme conditions](theme-conditions.md)                 |
| `useTheme()`          | The real theme values, merged over the providers above                                                      |
| `createStyle` options | Accepted so that one call runs on both platforms. Not used                                                  |
| `configure`           | Only `theme` is used. Throws after first use, as on the web                                                 |
| Engine                | There is none: no `getEngine`, `engine` or `cache`                                                          |

The outermost provider that renders gives the base theme, as on the web, unless you set one with `configure({ theme })` or `createStyle(theme)`.

## Style objects

A style is a `NativeStyleObject`. When the binding turns a style into a native style it:

- drops the keys that only the web has, each whole: `label`, selectors (a key with `&` or one that starts with `:`), at-rules and custom properties;
- keeps objects and arrays under any other key (`shadowOffset`, `transform`);
- merges the `native` part of a shared style over the rest and drops the `web` part;
- merges the parts of `when()` and `whenScheme()` keys that match.

In development it warns, once for each distinct message, about a shorthand with several values (`padding: '10px 20px'`) and a value with a CSS unit (`width: '12px'`). See [Typed styles](typed-styles.md).

## Arithmetic and `alpha`

The package exports `add`, `subtract`, `multiply`, `divide`, `negate` and `alpha`. Arithmetic returns real numbers, and a percentage stays a percentage; anything that cannot be computed throws. `alpha(color, opacity)` returns `rgba(r, g, b, opacity)` for `#rgb` and `#rrggbb`, and the colour unchanged for anything else. See [Tokens](tokens.md).

## One source for both platforms

`umber-style/react` is the same API, typed for both platforms, and resolves to this binding under the `react-native` export condition: see [Style sheets and the style prop](style-sheets.md).

## Limits

- **The React Native binding was never run in a real app.** The tests alias the one import of the platform (`react-native`) to a stand-in whose `StyleSheet.create` returns its input and whose `Appearance` is a stub, and they use plain host components that record their props. The styles were compiled against the real `react-native` types.
- Because of that, `StyleSheet.create` returning ids, `Appearance` changes, and the platform's own handling of an unknown key were not exercised.
- The color scheme of the platform is read when a component renders. A change of the system setting does not re-render a component by itself.
- Sheets made from a function are registered once for each theme object, kept in a `WeakMap`, so they are released with the theme object. A theme object that is re-created on every render registers a new sheet every time.
- `alpha` does not check its opacity.
