# @umber-style/react-native

The React Native binding of UmberStyle: the same names as the React binding, over the real theme values.

Not yet published. Once it is: `pnpm add @umber-style/react-native`.

```ts
import { styled, ThemeProvider } from '@umber-style/react-native'
```

## Typed styles

`NativeStyleObject` is the type of a style on React Native: the keys of the platform's view, text and image styles, each with the value type of the platform, and nothing nested. `styled`, `StyleSheet.create`, the `style` prop and `apply` take it, so a selector, an at-rule, `display: 'grid'` or a misspelt key (`paddng`) is an error in an object literal.

```ts
const Card = styled(View)({
  padding: 8,
  elevation: 2,
  transform: [{ rotate: '45deg' }],
})
```

The types come from the platform's own `ViewStyle`, `TextStyle` and `ImageStyle`, so `react-native` is a development dependency here and a peer of an app. What the types cannot reject is warned about in development, once for each message: a shorthand with several values (`padding: '10px 20px'`, `margin: '0 auto'`) and a value with a CSS unit (`width: '12px'`). Nothing is warned in production.

The binding drops every key that holds an object that is not an array (it is how the nested selectors of a style written for the web are removed), so an object-valued key such as `shadowOffset` is accepted by the types and dropped when the style is resolved. This is a known gap: use `boxShadow` or `elevation` for a shadow until the binding keeps those keys.
