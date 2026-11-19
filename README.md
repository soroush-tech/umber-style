# UmberStyle

UmberStyle is a styling engine. Every theme token is a CSS variable, so a style is the same for every
theme and is computed once, and a theme is a class: switching it re-renders nothing. It works with
React, React Native, Vue and plain JavaScript.

**Status: proof of concept.** Nothing is published to npm yet; every package is private and the API
can still change. The documentation will live at [umber-style.soroush.design](https://umber-style.soroush.design).

## Packages

| Package                      | Folder                   | What it is                                                                                      |
| ---------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `umber-style`                | `packages/umber-style`   | The umbrella: `umber-style`, `umber-style/react`, `umber-style/react-native`, `umber-style/vue` |
| `@umber-style/core`          | `packages/core`          | The engine: tokens, class cache, theme classes. No framework                                    |
| `@umber-style/react`         | `packages/react`         | `styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply` for React              |
| `@umber-style/react-native`  | `packages/react-native`  | The same names for React Native, over the real theme values                                     |
| `@umber-style/vue`           | `packages/vue`           | The same names for Vue, with a reactive `useTheme`                                              |
| `@umber-style/eslint-config` | `packages/eslint-config` | Private lint config shared by the packages. Not published                                       |

`umber-style/react` switches to the React Native binding under the `react-native` condition, so one
component source runs on both.

## Development

```sh
pnpm install
pnpm test:coverage   # 100% on every package
pnpm lint
pnpm typecheck
pnpm format:check
```

The standard for the packages is in [`packages/packages.md`](./packages/packages.md).

## Plain JavaScript

```ts
import { createEngine } from 'umber-style'

const theme = { palette: { primary: '#1b5fd1' }, space: [0, 4, 8] }
const engine = createEngine(theme, { prefix: 'app' })
const button = engine.css({ color: engine.refs.palette.primary, padding: engine.refs.space[2] })
document.documentElement.className = engine.themeClass(theme)
```

## React

```tsx
import { styled, ThemeProvider, StyleSheet, useStyle } from 'umber-style/react'

// Once per app: the shape of `theme` for every style function.
declare module '@umber-style/core' {
  interface Theme {
    palette: { primary: string }
    space: number[]
  }
}

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  background: theme.palette.primary,
}))

const sheet = StyleSheet.create((theme) => ({ box: { padding: theme.space[2] } }))

function Box() {
  const styles = useStyle(sheet)
  return <Button style={[styles.box, { opacity: 0.9 }]}>ok</Button>
}

const App = () => (
  <ThemeProvider theme={lightTheme}>
    <Box />
  </ThemeProvider>
)
```

The entries of a sheet in `style` join the one class of the component, plain objects stay inline.
Call `configure({ prefix })` from the binding before the first `styled` to change the options.

## Vue

```ts
import { styled, ThemeProvider } from 'umber-style/vue'
import { h } from 'vue'

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  background: theme.palette.primary,
}))

const App = () => h(ThemeProvider, { theme: lightTheme }, () => h(Button, null, () => 'ok'))
```

## React Native

```tsx
import { View } from 'react-native'
import { styled, ThemeProvider } from 'umber-style/react-native'

const Card = styled(View, { name: 'Card' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
}))

const App = () => (
  <ThemeProvider theme={lightTheme}>
    <Card />
  </ThemeProvider>
)
```

## The root theme

A normal `ThemeProvider` renders an element that carries the class of its theme, and that class
declares the whole theme below it. If the app also puts a theme class on `<html>` (to switch
light and dark with no render), the wrapper of an outermost provider overrides it for the whole page.
So the outermost provider is a root provider: `isRoot` renders no element and no class. It gives the
engine its base theme, makes sure the rule of the theme exists, and feeds the context, and that is all.
The app puts the class on an ancestor it controls:

```tsx
const light = themeClass(lightTheme, 'light')
const dark = themeClass(darkTheme, 'dark')

// <html class={light}>, and a script that runs before the first paint switches it with no render:
//   document.documentElement.className = localStorage.getItem('theme') === 'dark' ? dark : light

const App = () => (
  <ThemeProvider theme={lightTheme} isRoot>
    <Page />
  </ThemeProvider>
)
```

`isRoot` is a prop of the provider of every binding; React Native accepts and ignores it. Nested
providers stay normal: they change only the tokens they give, below their own element.

## No inline styles

On the web the engine never renders a `style` attribute: not on a provider's wrapper, not on a styled
component. A wrapper has classes only (the theme class, and `<prefix>-scope`, a shared class with
`display: contents`; the theme class itself has no `display`, because the same class goes on
`<html>`). Everything given in the `style` prop of a styled component, sheet entries and plain
objects, in order, is merged into the one class of the element, after its own styles and before
`className`. A string is an error, because it cannot be merged. `apply()` returns `{ className }` only.

A value that changes often (an animated or a measured number) makes a new class for each value, and
each class stays in the cache. Give such a value to a class as a CSS custom property that something
else sets, or drive it another way. React Native is unchanged: style objects are how it works.

What a strict content security policy still has to allow: the style attributes are gone, but the
engine inserts CSS through `<style>` elements: the one that the cache makes in the browser (rules
are added with `insertRule`), the one that `createStyleTag` writes for a static page or a classic server
render, and the `<style href precedence>` elements of the server build. A policy that blocks inline
style elements needs a nonce or a hash for them. There is no nonce option today, not in the cache, in
`createDomSheet`, in `createStyleTag` or in the server build: that is a gap.

## Server components

`@umber-style/react` has two builds, picked by the `react-server` export condition (the `umber-style/react`
entry has it too).

- The client build (the default) reads the theme of the nearest `ThemeProvider` from a React context, so a
  function style gets variables for the tokens and the real values of everything else (breakpoints,
  functions, component defaults). A component with only object styles reads no context.
- The server build has no hook and no context. A `ThemeProvider` there renders its element with the
  theme class, and the first provider of a request also writes the root theme into a slot that lives
  as long as the request (`React.cache`). Server components get the tokens as variables everywhere,
  and the raw values of that root theme. A nested provider changes the variables below it, but not the
  raw values a server component reads: only the first provider writes, because server components
  can render out of order and a nested one must not change what the root gave.
- Each styled element and each provider in the server build renders `<style href precedence>` with its
  rules, which React 19 moves to the head and renders once. `apply()` and sheets make classes and
  rules too, but nothing renders them: use them through `styled` (a sheet entry in `style`), or add
  the rules with `createStyleTag` from the engine.
- A theme holds functions, which cannot cross to client components. `useTheme()` in client code needs
  a `ThemeProvider` imported in a client file; the server build has `readTheme()` instead.
