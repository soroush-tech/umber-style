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

### A library that wraps the engine

A design system that re-exports the default style configures it for its users. Do it in a function that the app calls, not in a module that the library imports only for its side effect:

```ts
// engine.ts of the library
import { configure } from '@umber-style/react'
import { lightTheme } from './theme'

let isConfigured = false

/** Configures the engine of the library. The app calls it once, before it renders. */
export function setUpEngine(): void {
  if (isConfigured) return
  isConfigured = true
  configure({ prefix: 'soroush', theme: lightTheme })
}
```

A library whose `package.json` says `"sideEffects": false` tells the bundler that a module can be dropped when nothing it exports is used. `import './engine'` uses nothing, so a production build may leave the module out: `configure` never runs, and nothing says so, because an unconfigured default style works, with the prefix `css` and the default options. A function that the app calls is used, so it is kept. If the library keeps a module for its side effect, list it in `sideEffects` (`"sideEffects": ["./dist/engine.js"]`).

The call must also run before the first `styled(...)(...)` of the default style, because that call makes the engine with the options `configure` gave so far; `configure` throws after it. A component module that calls `styled` at its top level and is imported before the module that configures binds the default style unconfigured.

In development, a component of a default style that was never configured warns once when it renders under a `CacheProvider` whose cache has another key (the `key` of `createCache`): the warning names both prefixes and these two causes. A configured style may use a cache of any key, and a cache with the key `css` is the default prefix on purpose: neither warns. See [The cache and server packages](cache-and-server.md).

**`@umber-style/styled`** has the `styled` of the default style as its default export, for code that imports it that way. It is the same function, so `configure` from `@umber-style/react` sets it up, and under the `react-server` condition it is the `styled` of the server build:

```tsx
import styled from '@umber-style/styled'

const Card = styled.div({ padding: 16, borderRadius: 8 })
```

Its types are `Styled`, `StyledComponent`, `StyledFactory`, `StyledOptions`, `StyledStatics`, `StyledTags`, `StyleProp`, `CreateStyled`, `FilteringStyledOptions`, `PropsOf`, `CSSObject`, `Interpolation` and `Theme`, the same as in `@umber-style/react`.

## What the binding exports

| Name                                                       | What it is                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `createStyle(theme, options?)`                             | A new style for one theme: returns everything below, plus `engine` and `cache`         |
| `bindEngine(engine)`                                       | The same over an engine you made yourself                                              |
| `createDefaultStyle()`                                     | Makes one default style; the direct imports are made with it                           |
| `configure(options)`                                       | Options and base theme of the default style, before first use                          |
| `getEngine()`                                              | The engine of the default style                                                        |
| `styled`, `StyleSheet`, `useStyle`, `apply`                | Styling, sheets (an object sheet needs no `useStyle`), and putting entries on elements |
| `css`                                                      | One style made once and passed around: see [Style sheets](style-sheets.md)             |
| `keyframes`, `globalStyles`, `Global`                      | [Animations and global styles](animations-and-global-styles.md)                        |
| `ThemeProvider`, `useTheme`, `themeClass`                  | The theme                                                                              |
| `ThemeScope`, `useThemeClass`                              | The wrapper of the nearest nested provider, again, for portal content                  |
| `ThemeContext`                                             | The React context of the real theme, for `useContext` or a consumer                    |
| `CacheProvider`                                            | Gives a subtree its cache: see [The cache and server packages](cache-and-server.md)    |
| `when`, `whenScheme`                                       | Keys for [theme conditions](theme-conditions.md)                                       |
| `add`, `alpha`, `divide`, `multiply`, `negate`, `subtract` | The helpers of [Tokens](tokens.md)                                                     |

Types: `StyleOptions`, `DefaultStyleOptions`, `StyledOptions`, `FilteringStyledOptions`, `StyledStatics`, `StyleProp`, `StyledComponent`, `Styled`, `CreateStyled`, `StyledCall`, `StyledFactory`, `StyledTags`, `PropsOf`, `CssFunction`, `SheetDefinition`, `ThemeProviderProps`, `WebThemeProviderProps`, `ThemeScopeProps`, `CacheProviderProps`, `Style`, `WebStyle`, `ServerStyle`, `Theme` (the theme of the default style), `Interpolation`, and `ThemeInput` (the type of `theme`). The style types of the core are re-exported too: `CSSObject`, `SerializedStyles`, `Keyframes`, `UmberCache` and the others listed in [Typed styles](typed-styles.md).

`createStyle` returns a `WebStyle`: `styled`, `StyleSheet`, `useStyle`, `useStyleValue` (see [Writing styles](writing-styles.md#a-value-that-changes-without-a-render)), `apply`, `css`, `keyframes`, `globalStyles`, `Global`, `ThemeProvider`, `ThemeScope`, `ThemeContext`, `useTheme`, `useThemeClass`, `themeClass`, `when`, `whenScheme`, and `engine` and `cache`, the engine and its cache. The default style creates its `ThemeContext` before its engine, so the direct import exists before `configure`. The direct imports have no `engine` or `cache`: use `getEngine()` and `getEngine().cache`. `WebStyleObject` and the other style types (`WebProperties`, `WebNested`, `NestedKey`, `StyleObject`, `AlphaColor`, `SheetEntry`) are re-exported from this package as types, in both builds, and `at` and `alpha` and the arithmetic helpers are exported as values. See [Typed styles](typed-styles.md).

## `ThemeProvider`

| Prop          | Type                                | Default | Effect                                                                                                                                  |
| ------------- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`       | `ThemeInput<Theme>`                 | none    | The theme, or the part of it that this subtree changes, or a function of the theme above that returns it                                |
| `colorScheme` | `'light' \| 'dark' \| 'light dark'` | none    | Sets `color-scheme` (on `:root`, or in the theme class) and, for a nested provider with `light` or `dark`, adds the scheme marker class |
| `className`   | `string`                            | none    | Added to the classes of the wrapper of a nested provider                                                                                |
| `as`          | `string`                            | `'div'` | The element of the wrapper of a nested provider                                                                                         |
| `isRoot`      | `boolean`                           | `false` | Renders no element, no class and no rule: see [The root theme and switching](root-theme.md)                                             |
| `children`    | `ReactNode`                         | none    | The subtree                                                                                                                             |

The outermost provider (no provider of its engine above it in the page, of either build: a provider that a server component renders counts) renders no element: its theme is declared on `:root`. A nested provider renders a wrapper with `display: contents` and its theme classes. See [Themes](themes.md), which also shows `ThemeScope` and `useThemeClass` for portal content.

`ThemeScope` takes `children` only. `useThemeClass()` returns a `string`, or `undefined` under the outermost provider or none.

## `styled` in React

- A string tag receives the attributes of HTML and SVG by their React names, `data-*`, `aria-*`, event handlers and React's own props; `shouldForwardProp` replaces that default, for a tag and for a component alike. A custom element and a component tag receive every prop. `theme`, `className` and `style` are never passed on; `as` replaces a string tag (also at the end of a chain of styled components), and is passed on as a prop to a component that is not made by `styled`, which is rendered unless a `shouldForwardProp` keeps `as` off (then `as` replaces it) and is typed by that component's own `as`. See [Writing styles](writing-styles.md#as).
- `styled.div(...)` and the other HTML and SVG tags are shorthands for `styled('div')(...)`, typed as the tag, in both builds. `target` adds a class of your own to the element.
- `style` is typed `StyleProp`: sheet entries and web style objects in arrays, with falsy values dropped, and by default React's `CSSProperties` too, so props spread from `HTMLAttributes` fit (not with the strict switch of [Typed styles](typed-styles.md#the-default-types-and-the-strict-switch)). It never renders an attribute: see [No inline styles](no-inline-styles.md). In the browser, an element given a plain object counts the class that the object made, from the commit that shows it to the one that drops it (an insertion effect in a child that renders nothing, only for such an element), and the class is removed when no element uses it. A component that is never given a plain object has no such child and no extra hook.
- A component that has only object styles reads no context. One with a function style reads the view of the nearest provider's theme through a hook. The view stays the same object while only the values of tokens change, so such a component renders again only when a value that is not a token changes (a breakpoint, an `inline` token, a function in the theme).

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

## A cache for a subtree

`<CacheProvider value={cache}>` gives the subtree below it its cache: the classes, sheet entries, global rules, keyframes, root theme and theme classes of the components below are written there, by the engine of the same theme over that cache, whose prefix is the cache's. A `ThemeProvider` below it, under a provider outside it, is the outermost one of its cache and declares its theme on `:root` there. On a server it turns the automatic style elements off below it, so that a registry is the only output. A cache whose sheet is in an iframe styles a subtree that a portal renders there. One `CacheProvider` serves every style (the default one and those of `createStyle`). Under it the engine keeps the options of the style that describe how the styles are written (the token options, `hasValueRepair`, `hasColorFallbacks`, `hasBaseClass`) and takes from the cache what the cache holds (the prefix, the suffix, labels, layers, pruning, `hasScope`, the sheet):

| Option                                                          | Follows   | Why                                                                                                                                                                         |
| --------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rawKeys`, `lengthKeys`, `modes`, `registered`, `alwaysDeclare` | the style | They decide what a token is in the author's styles                                                                                                                          |
| `hasValueRepair`                                                | the style | The author wrote `var(--x)1F` and `-var(--x)` for it: without it the declaration is invalid and the browser drops it                                                        |
| `hasColorFallbacks`                                             | the style | How the author's `alpha()` values are written                                                                                                                               |
| `hasBaseClass`                                                  | the style | How a component's style list is split into classes                                                                                                                          |
| `hasDevChecks`                                                  | both      | The engine's own checks (what a style function returns, global styles) follow the engine's option; the cache's checks (the page, `CSS.supports`, values) follow the cache's |
| `prefix`                                                        | the cache | Classes and variables use the cache's prefix                                                                                                                                |
| `suffix`, `hasLabels`                                           | the cache | How the cache names its classes                                                                                                                                             |
| `hasLayers`, `hasPruning`, `hasScope`                           | the cache | How and where the cache stores its rules and themes                                                                                                                         |
| `hasRuleText`, `sheet`, `onInsert`                              | the cache | Where the rules go                                                                                                                                                          |

See [The cache and server packages](cache-and-server.md#cacheprovider-a-cache-for-a-subtree) for the details.

Until the first `CacheProvider` renders, no component reads it. From then on each styled component reads its context with `use`, which React lets a mounted component start to read without a change in the order of its hooks.

## Server components

The package has a second build for server components, picked by the `react-server` condition. It has `useTheme` too, a plain function there that returns the base theme, and `readTheme`, another name of it; it has no `ThemeContext`, `ThemeScope` or `useThemeClass`. In a client component `useTheme()` gives the theme of the nearest provider, also of one that a server component rendered; in a server component it gives the base theme, the same in every render. A component that needs the nearest theme's values in a server tree is marked `'use client'`, its code unchanged. See [Server rendering](server-rendering.md#usetheme-one-name-one-rule).

## Limits

- The context part of the binding is a client module (it has the `'use client'` directive). Whether a framework treats it as one was not checked.
- `useTheme()` returns the real theme, merged: do not mutate it. With no provider and no base theme it returns an empty object.
- The value of `ThemeContext` is `undefined` with no provider above, where `useTheme()` returns the base theme given to `createStyle(theme)` or `configure({ theme })` (a theme that a provider gave the engine does not count), or an empty object. Every style of one prefix shares one `ThemeContext`, as it shares the marks of the providers: two styles with one prefix see each other's providers.
- Below a provider of the server build, `useTheme()` reads the plain data of its theme only: a function or a class instance in that theme keeps the value of the theme above. See [Server rendering](server-rendering.md#what-crosses-to-the-browser).
- Under a nested provider the DOM has one more element; a portal without `ThemeScope` sees the outer theme. See [Themes](themes.md).
- The default style is one for the program: two copies of the package in one app share it, as they share the contexts of each prefix and of `CacheProvider` (see [How it works](how-it-works.md#two-copies-in-one-program)). A copy of 0.1.0 shares nothing.
- An element that is given a plain object in `style` renders a second child next to it, which renders nothing: the element's own state is kept when the object comes and goes (checked in jsdom), but the component's root is then a fragment.
- `apply`, `themeClass`, `when` and `whenScheme` are not hooks and do not see a `CacheProvider`: read a sheet with `useStyle` under the provider, so that `apply` writes its entries there. The server components build has no `CacheProvider`. The other limits of the provider are in [The cache and server packages](cache-and-server.md).
