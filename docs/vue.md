# Vue

After this page you can use the Vue binding: the provider, a reactive `useTheme`, sheets in `setup`, and the differences from the React API.

`@umber-style/vue` needs `vue` `^3.5.0`. The names are the same as in the React binding. What differs comes from how Vue works: components take attributes and slots, not props and children, and the theme is a computed ref.

## Getting the API

`createStyle(theme, options)` and the direct imports work as in [React](react.md): `configure({ prefix, theme })` before first use, or `createStyle(theme)` for a typed, separate engine. The result of `createStyle` also has `engine` and `cache`, and the default style has `getEngine()`. `bindEngine(engine)` gives the same API over an engine you made yourself with `createEngine` of the core.

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

| Area                | Vue                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Styled components   | Read `attrs`, not props. They take any attribute; nothing is typed                                                                                                                                                                                                                                                                                                                                                               |
| `class`             | Used instead of `className`: a string, array or object, as in Vue                                                                                                                                                                                                                                                                                                                                                                |
| Forwarding          | Every attribute but `as`, `theme`, `class` and `style` goes to a string tag unless `shouldForwardProp` says otherwise: Vue has no default filter of HTML attributes (see below). A component that is not made by `styled` is always rendered, and gets every attribute but `theme` and `style`, `as` included, with the engine's classes in `class`. Listeners (`onClick`) are attributes and are forwarded; slots are passed on |
| `useTheme()`        | Returns a computed ref of the real theme: read `.value`. It is reactive. Call it in `setup`. With no provider and no base theme its value is an empty object                                                                                                                                                                                                                                                                     |
| `useThemeClass()`   | Returns a computed ref of the class string of the wrapper of the nearest nested provider, or `undefined`. Call it in `setup`                                                                                                                                                                                                                                                                                                     |
| `ThemeScope`        | Renders the wrapper of the nearest nested provider again around its default slot, for content that a `Teleport` puts elsewhere; under the outermost provider, the slot alone                                                                                                                                                                                                                                                     |
| `useStyle(sheet)`   | Call it in `setup`. An object sheet (`StyleSheet.create({ ... })`) needs no `useStyle`: it is its entries, and `useStyle` returns it as it is                                                                                                                                                                                                                                                                                    |
| `apply(...entries)` | Returns `{ class }`, not `{ className }`                                                                                                                                                                                                                                                                                                                                                                                         |
| `css(...styles)`    | A sheet entry, as in React. Vue reads an object given to `class` as a map of class names, so `class: value` gives no class: write `String(value)` or `v-bind="apply(value)"`. In the `style` attribute of a styled component it works alone or in a list                                                                                                                                                                         |
| `ThemeProvider`     | Props `theme` (an object, or a function of the theme above), `colorScheme`, `as` and `isRoot`. The outermost provider renders no element; the attributes you pass (`class`, `id`) go to the wrapper of a nested provider                                                                                                                                                                                                         |
| Helpers             | `add`, `alpha`, `at`, `divide`, `multiply`, `negate` and `subtract` are exported, as in React. The style types (`WebStyleObject` and the others) are exported as types                                                                                                                                                                                                                                                           |
| Types               | `Theme` (the theme of the default style, which extends the core's), `StyledComponent` (a Vue component), `StyledOptions`, `FilteringStyledOptions`, `CreateStyled`, `PropsOf`, `Interpolation`, and the core's `CSSObject`, `SerializedStyles`, `Keyframes` and `UmberCache`                                                                                                                                                     |
| Templates           | `styled`, `css`, `keyframes` and `globalStyles` take the template form of [Writing styles](writing-styles.md). A function in a template is called with the attributes and `theme`                                                                                                                                                                                                                                                |

`styled.div(...)` and the other tags are shorthands for `styled('div')(...)`, and `target` adds a class of your own after the engine's classes, as in React: see [Writing styles](writing-styles.md).

Vue forwards every attribute to a string tag by default, where React keeps the props that are not HTML or SVG attributes off the element. In Vue, attributes that a component does not declare fall through to its element by design, they are written as they are given (`tabindex`, `stroke-width`, `for`, kebab-case or camelCase), and a list of React's names would drop the ones a template writes. Give `shouldForwardProp` to keep a prop off the element: `@umber-style/is-prop-valid/vue` is a filter of the attributes as Vue writes them, opt-in (see [Prop filters](prop-filters.md#vue)).

Entries in `style` work as in React: sheet entries and objects, in arrays, falsy values dropped, merged into one class, with no style attribute. In the browser a class made from a plain object is removed when no element uses it, as in React (see [No inline styles](no-inline-styles.md)): the element holds it through a function ref that the binding puts on it only when it is given a plain object. Vue merges the style objects of an array into one object, and keeps only the enumerable string keys of each. A sheet entry therefore has one enumerable key, a custom property named after its class with the value `null`, and the binding reads the entries back from those keys and turns them into class names before Vue renders anything.

A sheet entry given to the `style` of a plain element renders nothing in Vue on the client: Vue skips a `null` style value. Vue's server renderer writes `style=""` for any `style` prop, whatever it holds (an empty object or `null` as well), so a plain element given a `style` gets an empty attribute on the server; nothing declared is in it. For a plain element use `apply`.

A nested provider (under an outermost one with the theme above) given `{ palette: { primary: '#c2410c' } }`, a `class` of `mine` and `as: 'section'` renders `<section class="umber-theme-1an5zox umber-boundary umber-theme-1be996m umber-scope mine">`: the class of the theme it was given, the boundary, the class of its merged theme, the scope, and yours (`packages/vue/src/providers.docs.test.ts`).

There is no theme context to export in Vue: the providers use `provide` and `inject`, and `useTheme` reads them.

## A cache for a subtree

`CacheProvider`, with a `value` prop, gives the components in its slot its cache through `provide` and `inject`, with the same guarantees as in React (see [The cache and server packages](cache-and-server.md)): classes, entries of `useStyle` and `apply` of them, entries and `css()` values in `style`, `Global`, keyframes, the root theme and the theme classes go to that cache, by the engine of the same theme over it (`packages/vue/src/CacheProvider.test.ts`). What differs: `value` is read once, in `setup`, as `isRoot` is; to give the subtree another cache, render another provider (a new `key`). Vue has no automatic style elements, so there is nothing to turn off on a server. `inject` has no order to keep, so a styled component of an app that never sets up a `CacheProvider` makes no call for it, and one of an app that does calls `inject` on each render.

## Server rendering

`createSSRApp` and `renderToString` from `vue/server-renderer` work, and `createStyleTag(cache)` gives the CSS: see [Server rendering](server-rendering.md). There is no second build for Vue.

## Limits

- Examples use render functions. Single-file components with a template use the same components, but no test compiles a template, so that is not verified.
- The outermost provider and one with `isRoot` render their slot with no element. A `class` attribute given to them has no element to go to, and is dropped.
- Whether a provider is the outermost one, and `isRoot`, are read once, in `setup`.
- Under a nested provider the DOM has one more element; teleported content without `ThemeScope` sees the outer theme. See [Themes](themes.md).
- The Vue binding has no typed props for styled components.
- The `value` of `CacheProvider` is read once, in `setup`. `apply`, `themeClass` and `when` do not see a `CacheProvider`: read a sheet with `useStyle` under it.
- An element given a plain object in `style` gets a function ref of the binding, which counts the class. A `ref` you put on the styled component is not affected.
- Vue merges the objects of a `style` array by key before the binding sees them, so a sheet entry that appears twice in one array counts once, at its first place: `[a, b, a]` is the same class as `[a, b]`, and `b` wins over `a`, where in React the last `a` wins. Checked with Vue 3.5.45 in jsdom.
- A sheet entry given to the `style` of a plain element adds nothing to the attribute, on the client and on the server. That was observed in jsdom and in server output, not in a browser.
