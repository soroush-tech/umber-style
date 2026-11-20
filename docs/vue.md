# Vue

After this page you can use the Vue binding: the provider, a reactive `useTheme`, sheets in `setup`, and the differences from the React API.

`@umber-style/vue` needs `vue` `^3.5.0`. The names are the same as in the React binding. What differs comes from how Vue works: components take attributes and slots, not props and children, and the theme is a computed ref.

## Getting the API

`createStyle(theme, options)` and the direct imports work as in [React](react.md): `configure({ prefix, theme })` before first use, or `createStyle(theme)` for a typed, separate engine. The result of `createStyle` also has `engine` and `cache`, and the default style has `getEngine()`.

## A themed component and a sheet

```ts
import { createApp, defineComponent, h } from 'vue'
import { createStyle } from '@umber-style/vue'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}
const { styled, StyleSheet, useStyle, useTheme, ThemeProvider } = createStyle(theme, {
  prefix: 'umber',
})

const sheet = StyleSheet.create((theme) => ({
  box: { padding: theme.space[2] },
  active: { backgroundColor: theme.palette.primary },
}))

const Card = styled('div', { name: 'Card' })({ color: 'inherit' })

const Box = defineComponent({
  props: { isActive: Boolean },
  setup(props) {
    const styles = useStyle(sheet)
    const current = useTheme()
    return () =>
      h(
        Card,
        { style: [styles.box, props.isActive && styles.active] },
        () => current.value.palette.primary
      )
  },
})

createApp({
  render: () => h(ThemeProvider, { theme }, () => h(Box, { isActive: true })),
}).mount(document.createElement('div'))
```

It renders the card alone: the outermost provider renders no element, and declares its theme on `:root`.

```html
<div class="umber-card-root-1l5hymm umber-card-root-o63tmj">#1b5fd1</div>
```

## What is different from React

| Area                | Vue                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Styled components   | Read `attrs`, not props. They take any attribute; nothing is typed                                                                                                                                                       |
| `class`             | Used instead of `className`: a string, array or object, as in Vue                                                                                                                                                        |
| Forwarding          | Every attribute but `as`, `theme`, `class` and `style` goes to a string tag unless `shouldForwardProp` says otherwise. Listeners (`onClick`) are attributes and are forwarded; slots are passed on                       |
| `useTheme()`        | Returns a computed ref of the real theme: read `.value`. It is reactive. Call it in `setup`. With no provider and no base theme its value is an empty object                                                             |
| `useThemeClass()`   | Returns a computed ref of the class string of the wrapper of the nearest nested provider, or `undefined`. Call it in `setup`                                                                                             |
| `ThemeScope`        | Renders the wrapper of the nearest nested provider again around its default slot, for content that a `Teleport` puts elsewhere; under the outermost provider, the slot alone                                             |
| `useStyle(sheet)`   | Call it in `setup`. An object sheet (`StyleSheet.create({ ... })`) needs no `useStyle`: it is its entries, and `useStyle` returns it as it is                                                                            |
| `apply(...entries)` | Returns `{ class }`, not `{ className }`                                                                                                                                                                                 |
| `ThemeProvider`     | Props `theme` (an object, or a function of the theme above), `colorScheme`, `as` and `isRoot`. The outermost provider renders no element; the attributes you pass (`class`, `id`) go to the wrapper of a nested provider |
| Helpers             | `add`, `alpha`, `at`, `divide`, `multiply`, `negate` and `subtract` are exported, as in React. The style types (`WebStyleObject` and the others) are exported as types                                                   |

Entries in `style` work as in React: sheet entries and objects, in arrays, falsy values dropped, merged into one class, with no style attribute. Vue merges the style objects of an array into one object, and keeps only the enumerable string keys of each. A sheet entry therefore has one enumerable key, a custom property named after its class with the value `null`, and the binding reads the entries back from those keys and turns them into class names before Vue renders anything.

A sheet entry given to the `style` of a plain element renders nothing in Vue on the client: Vue skips a `null` style value. Vue's server renderer writes `style=""` for any `style` prop, whatever it holds (an empty object or `null` as well), so a plain element given a `style` gets an empty attribute on the server; nothing declared is in it. For a plain element use `apply`.

A nested provider (under an outermost one with the theme above) given `{ palette: { primary: '#c2410c' } }`, a `class` of `mine` and `as: 'section'` renders `<section class="umber-theme-1an5zox umber-boundary umber-theme-1be996m umber-scope mine">`: the class of the theme it was given, the boundary, the class of its merged theme, the scope, and yours (`packages/vue/src/providers.docs.test.ts`).

There is no theme context to export in Vue: the providers use `provide` and `inject`, and `useTheme` reads them.

## Server rendering

`createSSRApp` and `renderToString` from `vue/server-renderer` work, and `createStyleTag(cache)` gives the CSS: see [Server rendering](server-rendering.md). There is no second build for Vue.

## Limits

- Examples use render functions. Single-file components with a template use the same components, but no test compiles a template, so that is not verified.
- The outermost provider and one with `isRoot` render their slot with no element. A `class` attribute given to them has no element to go to, and is dropped.
- Whether a provider is the outermost one, and `isRoot`, are read once, in `setup`.
- Under a nested provider the DOM has one more element; teleported content without `ThemeScope` sees the outer theme. See [Themes](themes.md).
- The Vue binding has no typed props for styled components.
- Vue merges the objects of a `style` array by key before the binding sees them, so a sheet entry that appears twice in one array counts once, at its first place: `[a, b, a]` is the same class as `[a, b]`, and `b` wins over `a`, where in React the last `a` wins. Checked with Vue 3.5.45 in jsdom.
- A sheet entry given to the `style` of a plain element adds nothing to the attribute, on the client and on the server. That was observed in jsdom and in server output, not in a browser.
