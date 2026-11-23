# Prop filters

After this page you can keep the props of a component off the element it renders, on every platform, with one function: `isPropValid` of `@umber-style/is-prop-valid`, given as `shouldForwardProp`.

```sh
pnpm add @umber-style/is-prop-valid
```

The package has no root entry: `import ... from '@umber-style/is-prop-valid'` does not resolve. Each subpath is one function, `(prop: string) => boolean`, as its default export and as the named export `isPropValid` (`import { isPropValid } from '@umber-style/is-prop-valid/react'`), the same function:

| Subpath                                   | True for                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `@umber-style/is-prop-valid/react`        | the attributes of HTML and SVG under the names React gives them, and React's own props                                         |
| `@umber-style/is-prop-valid/vue`          | the attributes of HTML and SVG as a Vue template or render function writes them, and the DOM properties Vue sets by their name |
| `@umber-style/is-prop-valid/react-native` | the props of React Native's built-in components                                                                                |

Each is false for `as`, `theme` and any name it does not know: `variant`, `isActive`, `tone`, `sx`, `bg`, `p`, `mt`. The package depends on nothing and touches neither the DOM nor the platform.

## React

`@umber-style/is-prop-valid/react` is true for:

- the attributes of HTML and SVG, by their React names: `id`, `tabIndex`, `htmlFor`, `className`, `readOnly`, `autoPlay`, `srcSet`, `fetchPriority`, `popoverTarget`, `inert`, `strokeWidth`, `fillOpacity`, `viewBox`, `xlinkHref`, `xmlLang` and the rest;
- `data-*` and `aria-*`, in any case (`DATA-row` too: an HTML attribute name is not case-sensitive), and `x-*`;
- event handlers: `on` followed by any character whose code is below 91 (`[`). That is an upper-case letter (`onClick`, `onPointerDownCapture`), and also a digit, a space, `-`, `:`, `@` and the other ASCII signs below `[` (`on-click`, `on1`, `on:x`), which the predicate apps use today accepts too. React itself writes no prop of that second shape to a host element;
- React's own props: `children`, `ref`, `key`, `style`, `dangerouslySetInnerHTML`, `defaultValue`, `defaultChecked`, `suppressHydrationWarning`, `suppressContentEditableWarning`, `precedence`;
- older and other spellings that apps forward: `class`, `for`, `autofocus`, `fetchpriority`, `innerHTML`, `allowTransparency`, `valueLink`.

It is the default filter of a string tag in the React binding (see [Which props reach the element](writing-styles.md#which-props-reach-the-element)). Give it yourself where the binding forwards every prop, to a component, or build a filter of your own on it (`packages/react/src/propFilters.docs.test.tsx`):

```tsx
import type { ComponentProps } from 'react'
import { createStyle } from '@umber-style/react'
import isPropValid from '@umber-style/is-prop-valid/react'

const theme = { palette: { primary: '#1b5fd1', text: '#1a1a1a' } }
const { styled } = createStyle(theme, { prefix: 'umber', hasServerStyleElements: false })

function Anchor(props: ComponentProps<'a'>) {
  return <a {...props} />
}

const Link = styled(Anchor, { shouldForwardProp: isPropValid })<{ tone?: 'primary' }>(
  ({ theme, tone }) => ({ color: tone === 'primary' ? theme.palette.primary : 'inherit' })
)

const Swatch = styled('div', {
  shouldForwardProp: (prop) => isPropValid(prop) && prop !== 'color',
})<{ color?: string }>(({ color }) => ({ backgroundColor: color }))
```

`<Link tone="primary" href="/docs" />` renders `<a href="/docs" class="umber-...">`: `Anchor` gets `href` and the class, not `tone`. `<Swatch color="#c2410c" title="orange" />` renders `<div title="orange" class="umber-...">`.

## Vue

`@umber-style/is-prop-valid/vue` is true for:

- the attributes of HTML in their HTML form: `class`, `for`, `tabindex`, `readonly`, `maxlength`, `http-equiv`, `accept-charset`, `autoplay`, `srcset`, `popover`, `popovertarget`;
- the attributes of SVG in their XML form: kebab-case for the presentation attributes (`stroke-width`, `fill-opacity`), camelCase where SVG has it (`viewBox`, `preserveAspectRatio`, `stdDeviation`), and the namespaced ones (`xlink:href`, `xml:lang`, `xmlns:xlink`);
- the DOM properties that Vue sets by their name on an element: `tabIndex`, `readOnly`, `maxLength`, `className`, `htmlFor`, `innerHTML`, `innerText`, `textContent`, `defaultValue`;
- `data-*` and `aria-*`, in lower case;
- listeners: `on` followed by an upper-case letter, with any suffix (`onClick`, `onClickOnce`, `onScrollPassive`, `onUpdate:modelValue`);
- `class`, `style`, `key`, `ref`, `is`, and the `ref_for` and `ref_key` of Vue's types.

It is false for React's spellings that Vue writes as they are given and an element does not know (`strokeWidth`, `xmlLang`, `children`, `dangerouslySetInnerHTML`), and for `x-*`.

The Vue binding has no default filter: a string tag gets every attribute (see [Vue](vue.md)), and it stays so. The entry is opt-in: give it as `shouldForwardProp` to keep the attributes that only the styles read off the element. It applies to a string tag; a component gets every attribute, as before (`packages/vue/src/propFilters.docs.test.ts`):

```ts
import { createSSRApp, h } from 'vue'
import { createStyle } from '@umber-style/vue'
import isPropValid from '@umber-style/is-prop-valid/vue'

const theme = { palette: { primary: '#1b5fd1', text: '#1a1a1a' } }
const { styled } = createStyle(theme, { prefix: 'umber' })

const Box = styled('div', { shouldForwardProp: isPropValid })(({ theme, tone }) => ({
  color: tone === 'primary' ? theme.palette.primary : theme.palette.text,
}))

const app = createSSRApp({
  render: () => h(Box, { tone: 'primary', tabindex: 0, onClick: () => {} }),
})
```

The app renders `<div tabindex="0" class="umber-...">`, with the listener and without `tone`. Without the filter, the same `Box` renders `tone="primary"` on the element.

## React Native

`@umber-style/is-prop-valid/react-native` is true for the props of React Native's built-in components: `View`, `Text`, `Image`, `ImageBackground`, `TextInput`, `ScrollView`, `FlatList`, `SectionList`, `VirtualizedList`, `Pressable`, `Button`, `Switch`, `Modal`, `ActivityIndicator`, `KeyboardAvoidingView`, `SafeAreaView`, `RefreshControl`, `StatusBar`, `TouchableOpacity`, `TouchableHighlight` and `TouchableWithoutFeedback`. That is the union of their props: `testID`, `nativeID`, `hitSlop`, `pointerEvents`, `numberOfLines`, `source`, `keyboardType`, `renderItem`, and the rest; with `aria-*`, `accessibility` followed by an upper-case letter (`accessibilityLabel`), handlers (`onPress`, `onLayout`), `style`, `children`, `ref` and `key`. It is false for the attributes of the web: `className`, `htmlFor`, `data-*`.

The React Native binding forwards every prop to the component but `as`, `theme` and `style` (see [React Native](react-native.md)), and it stays so. The entry is opt-in: give it to keep the props that only the styles read off a built-in component (`packages/react-native/src/propFilters.docs.test.tsx`, with a stand-in for `View`):

```tsx
import { View } from 'react-native'
import { createStyle } from '@umber-style/react-native'
import isPropValid from '@umber-style/is-prop-valid/react-native'

const theme = { palette: { primary: '#1b5fd1' } }
const { styled } = createStyle(theme)

const Card = styled(View, { shouldForwardProp: isPropValid })<{ elevated?: boolean }>(
  ({ elevated }) => ({ padding: 16, elevation: elevated ? 4 : 0 })
)
```

`<Card elevated testID="card" />` gives `View` the props `testID` and `style`, not `elevated`.

## The three side by side

| Prop                                  | `/react`                 | `/vue`                | `/react-native`                       |
| ------------------------------------- | ------------------------ | --------------------- | ------------------------------------- |
| `tabIndex`                            | true                     | true (a DOM property) | true (`View`, `TextInput` and others) |
| `tabindex`                            | false                    | true                  | false                                 |
| `className`                           | true                     | true (a DOM property) | false                                 |
| `class`                               | true (an older spelling) | true                  | false                                 |
| `htmlFor` / `for`                     | true / true              | true / true           | false / false                         |
| `readOnly` / `readonly`               | true / false             | true / true           | true / false (`TextInput`)            |
| `strokeWidth` / `stroke-width`        | true / false             | false / true          | false / false                         |
| `viewBox`                             | true                     | true                  | false                                 |
| `xlinkHref` / `xlink:href`            | true / false             | true / true           | false / false                         |
| `innerHTML` / `textContent`           | true / false             | true / true           | false / false                         |
| `children`, `dangerouslySetInnerHTML` | true                     | false                 | true, false                           |
| `style`, `key`, `ref`                 | true                     | true                  | true                                  |
| `data-row`                            | true                     | true                  | false                                 |
| `DATA-row`                            | true                     | false                 | false                                 |
| `x-init`                              | true                     | false                 | false                                 |
| `aria-label`                          | true                     | true                  | true                                  |
| `accessibilityLabel`                  | false                    | false                 | true                                  |
| `onClick`, `onPress`                  | true                     | true                  | true                                  |
| `onClickOnce`, `onUpdate:modelValue`  | true                     | true                  | true                                  |
| `on-click`, `on1`                     | true                     | false                 | false                                 |
| `onclick`                             | false                    | false                 | false                                 |
| `testID`, `nativeID`                  | false                    | false                 | true                                  |
| `color`, `size`, `width`, `height`    | true                     | true                  | true                                  |
| `as`, `theme`, `variant`, `bg`, `p`   | false                    | false                 | false                                 |

`color`, `size`, `width` and `height` are true everywhere because each is a real attribute or prop somewhere: on the web `size` of an `input` or a `select`, `width` and `height` of an `img`, a `canvas` or an SVG element, `color` of SVG and of the older `font` and `hr`; on React Native `color` of `ActivityIndicator` and `Button`, `size` of `ActivityIndicator` and `RefreshControl`, `width` and `height` of `Image`. A component whose own prop has one of these names, a `size` that picks a variant or a `color` that names a theme color, keeps it off the element with a filter of its own: `(prop) => isPropValid(prop) && prop !== 'size'`, as `Swatch` does above.

Each answer is kept by name after the first call, so a name is looked up once; the lists are expanded at the first call, not when the module is loaded. A name that a prefix rule answers (`data-row-12`) is not kept, so the names an app makes at run time do not grow the store.

## Coming from the predicate apps use today

The React entry is true for every name that the predicate apps use today is true for, with no exception: a comparison over 11644 names (every name either list knows, every key of the three platforms' types, and 10027 generated names: camelCase and kebab-case words, the prefixes in several cases, `on` with every ASCII character, random names) found none that it accepts and the entry refuses. The entry is also true for 45 names that the other predicate does not know: newer attributes (`blocking`, `closedBy`, `command`, `commandFor`, `shadowRootMode`, `writingSuggestions`), React's `precedence`, legacy table and frame attributes (`align`, `valign`, `bgcolor`, `border`, `frame`, `rules`), `part` and `exportparts`, and the attributes of the `webview` element that React's types declare (`nodeintegration`, `webpreferences`, `partition`). A string tag that forwards one of them now writes it to the element.

## Limits

- The lists follow the versions they were read from: `@types/react` 19.3.0 for `/react`, `vue` 3.5.45 (`@vue/runtime-dom`) for `/vue`, `react-native` 0.88.1 for `/react-native`, with the DOM properties of the `lib.dom.d.ts` of TypeScript 6.0.3. An attribute added after them is false until the list is updated. The tests compare each list with the installed type definitions both ways, so an update of those definitions names what changed.
- `/react-native` knows the built-in components listed above only. `TouchableNativeFeedback` and `InputAccessoryView` are not in it (their own props, such as `background` and `useForeground`, are false), and a native component that is not built in (from a library or your own native module) takes the props it declares, which the entry does not know: give that component a filter of its own.
- `/react-native` is the union of the props of every built-in component: a prop of one (`numberOfLines` of `Text`) is true for all of them (`View`).
- `/vue` is checked against Vue's types and the HTML and SVG names; no test renders every name in a browser. It does not accept the camelCase forms that the browser lower-cases (`autoPlay` on an HTML element works in Vue, and is false here), and it does not accept `x-*`.
- None of the entries knows which element a prop goes to: `size` is true for a `div` too.
- The comparison with the predicate apps use today was a one-off run outside the repository; no test of the repository runs it again.
- The React Native example ran against a stand-in for `View`; the platform itself is not run here.
