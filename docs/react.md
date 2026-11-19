# React

After this page you can choose between the two ways of getting the React API, and you know what the React binding has that the other bindings do not.

`@umber-style/react` needs `react` `^19.2.8`. Most of what you use is on other pages: [Writing styles](writing-styles.md), [Style sheets and the style prop](style-sheets.md), [Themes](themes.md).

## Two ways to get the API

**`createStyle(theme, options)`** returns an object with the API for that theme: its own engine and cache, and types inferred from `theme`. Use it when you have one theme shape and want it typed with no declaration:

```tsx
import { createStyle } from '@umber-style/react'

const style = createStyle(lightTheme, { prefix: 'umber' })
export const { styled, ThemeProvider, useTheme, StyleSheet, useStyle, apply } = style
```

**Direct imports** (`import { styled } from '@umber-style/react'`) are one default style that makes its engine on first use. Its theme type is the interface `Theme` of `@umber-style/core`, which you declare once, as in [Themes](themes.md). Configure it before first use:

```ts
import { configure } from '@umber-style/react'

configure({ prefix: 'umber', theme: lightTheme })
```

`configure` takes the options of `createStyle` and a `theme`. It throws if the default style has already been used.

## What the binding exports

| Name                                                       | What it is                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `createStyle(theme, options?)`                             | A new style for one theme: returns everything below, plus `engine` and `cache` |
| `bindEngine(engine)`                                       | The same over an engine you made yourself                                      |
| `createDefaultStyle()`                                     | Makes one default style; the direct imports are made with it                   |
| `configure(options)`                                       | Options and base theme of the default style, before first use                  |
| `getEngine()`                                              | The engine of the default style                                                |
| `styled`, `StyleSheet`, `useStyle`, `apply`                | Styling, sheets, and putting entries on elements                               |
| `ThemeProvider`, `useTheme`, `themeClass`                  | The theme                                                                      |
| `when`, `whenScheme`                                       | Keys for [theme conditions](theme-conditions.md)                               |
| `add`, `alpha`, `divide`, `multiply`, `negate`, `subtract` | The helpers of [Tokens](tokens.md)                                             |

Types: `StyleOptions`, `DefaultStyleOptions`, `StyledOptions`, `StyledStatics`, `StyleProp`, `StyledComponent`, `Styled`, `SheetDefinition`, `ThemeProviderProps`, `WebThemeProviderProps`, `Style`, `WebStyle`, `ServerStyle`.

`createStyle` returns a `WebStyle`: `styled`, `StyleSheet`, `useStyle`, `apply`, `ThemeProvider`, `useTheme`, `themeClass`, `when`, `whenScheme`, and `engine` and `cache`, the engine and its cache. The direct imports have no `engine` or `cache`: use `getEngine()` and `getEngine().cache`. `WebStyleObject` and the other style types (`WebProperties`, `WebNested`, `NestedKey`, `StyleObject`, `AlphaColor`, `SheetEntry`) are re-exported from this package as types, in both builds, and `at` and `alpha` and the arithmetic helpers are exported as values. See [Typed styles](typed-styles.md).

## `ThemeProvider`

| Prop          | Type                                | Default | Effect                                                                                           |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `theme`       | `DeepPartial<Theme>`                | none    | The theme, or the part of it that this subtree changes                                           |
| `colorScheme` | `'light' \| 'dark' \| 'light dark'` | none    | Sets `color-scheme` in the theme class and, for `light` and `dark`, adds the scheme marker class |
| `className`   | `string`                            | none    | Added to the classes of the wrapper                                                              |
| `as`          | `string`                            | `'div'` | The element that carries the theme class                                                         |
| `isRoot`      | `boolean`                           | `false` | Renders no element, no class and no rule: see [The root theme and switching](root-theme.md)      |
| `children`    | `ReactNode`                         | none    | The subtree                                                                                      |

## `styled` in React

- Every prop except `as`, `theme`, `className` and `style` is forwarded to a string tag unless `shouldForwardProp` says otherwise. For a component tag, all but those four are passed on.
- `style` is typed `StyleProp`: sheet entries and web style objects in arrays, with falsy values dropped. It never renders an attribute: see [No inline styles](no-inline-styles.md).
- A component that has only object styles reads no context. One with a function style reads the nearest provider's theme through a hook, so it re-renders when the theme above changes.

## Sharing one engine with another binding

`createStyle` accepts an existing engine. Two bindings that share it have one cache and make the same class names:

```tsx
import { createEngine } from '@umber-style/core'
import { createStyle as createReactStyle } from '@umber-style/react'
import { createStyle as createVueStyle } from '@umber-style/vue'

const theme = { palette: { primary: '#1b5fd1' }, space: [0, 4, 8] }
const engine = createEngine(theme, { prefix: 'umber' })

const reactStyle = createReactStyle(theme, { engine })
const vueStyle = createVueStyle(theme, { engine })
```

A `span` styled with the same style in both bindings gets the same class name (this was run).

## Server components

The package has a second build for server components, picked by the `react-server` condition. It has `readTheme` instead of `useTheme`. See [Server rendering](server-rendering.md).

## Limits

- The context part of the binding is a client module (it has the `'use client'` directive). Whether a framework treats it as one was not checked.
- `useTheme()` returns the real theme, merged: do not mutate it.
- The default style is a module singleton. Two copies of the package in one app are two engines.
