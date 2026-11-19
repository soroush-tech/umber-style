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

It renders:

```html
<div class="umber-theme-b2oxy9 umber-boundary umber-scope">
  <div class="umber-card-root-1l5hymm umber-card-root-o63tmj">#1b5fd1</div>
</div>
```

## What is different from React

| Area                | Vue                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styled components   | Read `attrs`, not props. They take any attribute; nothing is typed                                                                                                                                 |
| `class`             | Used instead of `className`: a string, array or object, as in Vue                                                                                                                                  |
| Forwarding          | Every attribute but `as`, `theme`, `class` and `style` goes to a string tag unless `shouldForwardProp` says otherwise. Listeners (`onClick`) are attributes and are forwarded; slots are passed on |
| `useTheme()`        | Returns a computed ref of the real theme: read `.value`. It is reactive. Call it in `setup`                                                                                                        |
| `useStyle(sheet)`   | Call it in `setup`                                                                                                                                                                                 |
| `apply(...entries)` | Returns `{ class }`, not `{ className }`                                                                                                                                                           |
| `ThemeProvider`     | Props `theme`, `colorScheme`, `as` and `isRoot`. A `class` you pass falls through to the wrapper, as for any Vue component                                                                         |
| Helpers             | `add`, `alpha`, `divide`, `multiply`, `negate` and `subtract` are not exported by this package. Import them from `@umber-style/core` or `umber-style`                                              |

Entries in `style` work as in React: sheet entries and objects, in arrays, falsy values dropped, merged into one class, with no style attribute. A sheet entry holds a custom-property key named after its class so that Vue's own merging of style objects keeps every entry; the binding turns the entries back into class names before Vue renders anything.

A wrapper made by `ThemeProvider` with a `class` of `mine` and `as: 'section'` renders `<section class="umber-theme-14mu3wo umber-boundary umber-scope mine">`.

## Server rendering

`createSSRApp` and `renderToString` from `vue/server-renderer` work, and `createStyleTag(cache)` gives the CSS: see [Server rendering](server-rendering.md). There is no second build for Vue.

## Limits

- Examples use render functions. Single-file components with a template use the same components, but no test compiles a template, so that is not verified.
- `isRoot` renders a fragment. A `class` attribute on a root `ThemeProvider` has no element to fall onto. Not tried.
- The Vue binding has no typed props for styled components.
