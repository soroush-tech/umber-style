# Themes

After this page you can give a page and a subtree their themes, theme portal content, read theme values in JavaScript, know what a style function sees as `theme`, and type your theme in two ways.

## The provider

`ThemeProvider` takes a theme and makes it the theme of everything below it. How it does that on the web depends on whether another provider is above it:

- **The outermost provider** (no provider above it) renders no element and puts no class on `<html>`. It declares the variables of its theme on the document root, in one rule `:where(:root){...}` in the `theme` layer. Everything on the page sees them: plain elements, portal content, and the rules for `html` and `body` that `Global` writes. A change of its theme rewrites that one rule, and no styled component renders again (unless the theme changes a value that is not a token, see below).
- **A nested provider** renders one wrapper element, which carries its classes.

```html
<div class="umber-theme-1lpp26f umber-boundary umber-theme-3cgoer umber-scope">...</div>
```

- `umber-theme-1lpp26f` is the theme class of the theme it was given: it declares those variables. The hash is of the declarations. [Theme conditions](theme-conditions.md) match it.
- `umber-boundary` marks an element that starts a theme. Theme conditions use it.
- `umber-scheme-light` or `umber-scheme-dark` is added when you pass `colorScheme="light"` or `"dark"`.
- `umber-theme-3cgoer` is the theme class of its whole merged theme (its theme over the ones above), with every variable that the page uses. It is there for content whose element is not inside the wrappers above it, such as a provider rendered through a portal. When the theme it was given is already the whole theme, the two classes are one, and it is written once.
- `umber-scope` has `display: contents`, so the wrapper takes no space in the layout. It is a class, not an inline style.

A change of a nested provider's theme changes these classes, and no styled component renders again either.

The `theme` prop is a partial theme. A nested provider gives only what it changes and the rest comes from the provider above:

```tsx
import { at, createStyle } from '@umber-style/react'

const lightTheme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a', surface: '#ffffff' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider, useTheme } = createStyle(lightTheme, { prefix: 'umber' })

const Card = styled('div', { name: 'Card' })(({ theme }) => ({
  color: theme.palette.text,
  backgroundColor: theme.palette.surface,
  ...at(`@media (min-width: ${theme.breakpoints[0]})`, { padding: theme.space[3] }),
}))

function Swatch() {
  const theme = useTheme()
  return <code>{theme.palette.primary}</code>
}

const App = () => (
  <ThemeProvider theme={lightTheme}>
    <Card />
    <ThemeProvider theme={{ palette: { surface: '#fff4d6' } }}>
      <Card />
    </ThemeProvider>
    <ThemeProvider theme={{ breakpoints: ['480px'] }}>
      <Card />
    </ThemeProvider>
    <ThemeProvider theme={{ palette: { primary: '#0b7a4b' } }}>
      <Swatch />
    </ThemeProvider>
  </ThemeProvider>
)
```

The result:

```html
<div class="umber-card-root-c45tr"></div>
<div class="umber-theme-1lpp26f umber-boundary umber-theme-3cgoer umber-scope">
  <div class="umber-card-root-c45tr"></div>
</div>
<div class="umber-theme-0 umber-boundary umber-theme-1x8aice umber-scope">
  <div class="umber-card-root-1h3unrm"></div>
</div>
<div class="umber-theme-45hmwp umber-boundary umber-theme-q5wsxh umber-scope">
  <code>#0b7a4b</code>
</div>
```

```text
:where(:root){--umber-palette-text:#1a1a1a;--umber-palette-surface:#ffffff;--umber-space-3:16px;}
.umber-theme-1lpp26f{--umber-palette-surface:#fff4d6;}
.umber-theme-3cgoer{--umber-palette-text:#1a1a1a;--umber-palette-surface:#fff4d6;--umber-space-3:16px;}
.umber-card-root-c45tr{color:var(--umber-palette-text);background-color:var(--umber-palette-surface);}
@media (min-width: 600px){.umber-card-root-c45tr{padding:var(--umber-space-3);}}
.umber-card-root-1h3unrm{color:var(--umber-palette-text);background-color:var(--umber-palette-surface);}
@media (min-width: 480px){.umber-card-root-1h3unrm{padding:var(--umber-space-3);}}
```

(Each rule is inside its cascade layer; the layers, the `umber-scope` rule and the classes of the merged themes of the last two providers are left out here. The markup is shown with line breaks; the CSS is the engine's text, one rule on a line. It is the output of a classic server render, asserted in `packages/react/src/providers.docs.ssr.test.tsx`.)

- The outermost provider has no element: the first Card is at the top, and its theme is on `:root`.
- The second provider changes one token. Its theme class declares one variable, and the Card inside has the same class as the first, because only a variable changed.
- The third provider changes a breakpoint. A breakpoint is not a token (see below), so it is written into the media rule and the Card inside has its own class. Its own theme class is `umber-theme-0`: it has nothing to declare, so no rule is written for it.

### A function of the theme above

`theme` can be a function of the theme above it. It returns the theme to give, which is merged over that theme like an object:

```tsx
<ThemeProvider theme={(outer) => ({ palette: { surface: outer.palette.text } })}>
```

The outermost provider calls it with the base theme that was given (`createStyle(theme)`, `configure({ theme })`), or with an empty object when none was. In the server components build every provider calls it with the base theme, in every render: no context tells a server component which providers are above it, and a request that renders only a part of the page (a client-side navigation in the App Router renders the segment that changed) does not render the providers of the layouts above. See [Server rendering](server-rendering.md#server-components).

### Portal content: `ThemeScope` and `useThemeClass`

Content that a portal (`createPortal`, a Vue `Teleport`) puts elsewhere in the document is outside the wrapper of the nested provider above it in the tree, so it sees the variables of `:root`, the outer theme. `ThemeScope` gives it the nested theme: it renders the wrapper of the nearest nested provider again (the same element and classes) around its children. Under the outermost provider only, or under none, it renders its children and no element.

```tsx
const { ThemeProvider, ThemeScope } = createStyle(lightTheme, { prefix: 'umber' })
const darkTheme = { palette: { text: '#f2f2f2', surface: '#101114' } }

const Dialog = () =>
  createPortal(
    <ThemeScope>
      <Card />
    </ThemeScope>,
    document.body
  )

const App = () => (
  <ThemeProvider theme={lightTheme}>
    <ThemeProvider theme={darkTheme}>
      <Dialog />
    </ThemeProvider>
  </ThemeProvider>
)
```

`useThemeClass()` returns the class string of that wrapper, or `undefined`, for code that already has a container element of its own (the root element of a dialog component): put the class on it. A theme change reaches `ThemeScope` and `useThemeClass` as it reaches the wrapper.

A provider rendered inside portal content is merged over the providers above it in the tree, and its wrapper declares its whole merged theme (the class of the merged theme, above), so it shows its own theme there too.

Both exist in the React client build and in Vue (where `useThemeClass()` returns a computed ref). The server components build has no portal and has neither; in a client component below a nested provider of the server build they give that provider's wrapper, which declares the theme it was given. `useTheme()` in portal content reads the theme of the nearest provider in the tree, with `ThemeScope` or without it. On React Native `ThemeScope` renders its children and `useThemeClass()` returns `undefined`: a modal stays inside the React tree, so its content already reads the theme of the provider above it.

These cases are checked in a real browser (Chromium) by `packages/react/src/themeProvider.browser.test.tsx`: the computed values below the wrapper of a nested provider, plain elements too; portal content with and without `ThemeScope`; a provider inside portal content under a nested provider.

### The theme context

`ThemeContext` (React client build and React Native) is the React context that holds the real theme of the nearest provider, merged over the ones above: `<ThemeContext.Consumer>{(theme) => ...}</ThemeContext.Consumer>`, or `useContext(ThemeContext)`. With no provider above, its value is `undefined`; `useTheme()` gives the given base theme there instead, or an empty object. On the web every style of one prefix shares it, and a provider of the server build fills it too, with the plain data of its theme (see [Server rendering](server-rendering.md#what-crosses-to-the-browser)).

### Two React roots on one page

Each React root's outermost provider writes to `:root`, so several roots on one page should share a theme. An engine has one `:root` rule. Two React roots whose outermost providers share an engine (the default style, or one `createStyle`) share it: the theme of the provider that committed last is the one on `:root`, for both. Give both the same theme, which is the usual case (islands of one app). For a root that needs another theme, give its outermost provider the same theme as the other root, and put the theme it needs on a nested provider inside it: that one renders its wrapper.

## What a style function sees as `theme`

A function style (and a function sheet) gets the theme as a view of the nearest provider:

| Part of the theme                                | In the view                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| A token (a string or number in `variable` mode)  | A `var(--name)` reference                       |
| A `reference` token                              | `var(--name, <base value>)`                     |
| An `inline` or `raw` token, anything not a token | The real value, taken from the nearest provider |

By default `breakpoints` and `components` are raw, and everything else is a variable. `modes` changes that for any path: see [Tokens](tokens.md). Real values are why a nested theme with another breakpoint gets its own class, as above. A function in the theme (a helper, a mixin) is a real value too.

## Reading values in JavaScript: `useTheme`

`useTheme()` returns the real values of the nearest provider, merged over the providers above: `theme.palette.primary` is `'#0b7a4b'` in `Swatch`, not a reference. Use it when JavaScript needs a number or a name (a chart colour, a measured size). Do not write it into a style: a style function already receives `theme` for that, and a real value in a style makes the class depend on the theme.

`useTheme()` is the one name in both React builds, so a component that reads the theme is written once:

- In a client component it gives the theme of the nearest provider, whether a client file or a server component rendered that provider.
- In a server component (the server components build) it gives the base theme, the same in every render: a server component cannot see the providers above it.
- A component that needs the nearest theme's values in a server tree is marked `'use client'`, its code unchanged. See [Server rendering](server-rendering.md#usetheme-one-name-one-rule).

| Binding      | `useTheme()` returns                             |
| ------------ | ------------------------------------------------ |
| React        | the theme                                        |
| React Native | the theme                                        |
| Vue          | a computed ref of the theme (`useTheme().value`) |

In a client component of React the theme is the same object from render to render while the theme given to each provider above is (`toBe`, so it can be a dependency of a memo or an effect). A branch that a provider's theme does not change is the object of the theme above, not a copy, and an outermost provider with no given base theme gives the very object it was given.

With no provider above, `useTheme()` returns the base theme that was given on purpose (below), or an empty object when none was. A theme that a provider gave the engine does not count: once that provider unmounts, a tree with no provider has the empty theme again, in every binding. Styles still render: a style function then gets an empty theme, and one that reads a token (`theme.palette.primary`) throws a `TypeError` of the language, because `theme.palette` is `undefined`.

## The base theme

The engine needs one full theme to know its shape: which tokens exist and what their variables are called. It is the base theme. It comes from the first of these:

- `createStyle(theme)`, or `createEngine(theme)`.
- `configure({ theme })`, for the default style.
- The first `ThemeProvider` that renders, or the first `themeClass(theme)` or `when(theme)` call, when none of the above was used. That theme gives the engine its shape (`engine.baseTheme`), so give the full theme to the outermost provider, not a partial one. It is not a given base theme (`engine.givenTheme` stays empty): `useTheme()` with no provider above, the outermost provider's merge and its function theme, a function style, a function sheet and `Global` with no provider, and `useTheme()` of every server component read only a theme given with `createStyle(theme)`, `configure({ theme })`, `createEngine(theme)` or `setTheme`. A provider of the server components build never gives the engine a theme at all.

With no given base theme and no provider, a style function, a function sheet and `Global` get an empty theme, and `useTheme` returns an empty object. What needs the shape of the theme still throws `There is no theme yet: render a ThemeProvider with the full theme first, or call setTheme (or configure({ theme })) before a function style, a sheet or useTheme is used.`: the engine's own calls, such as `engine.refs`, and `keyframes` steps given as a function of the theme.

Arrays are replaced as a whole in the real values: a provider with `{ space: [0, 8] }` makes `useTheme().space` that two-item array. The variables are per item, so only `--umber-space-0` and `--umber-space-1` are redeclared and `--umber-space-2` and `--umber-space-3` keep the outer values. If you need to change an array, give all of it.

A merge keeps every own member of an object, with its descriptor: a helper function that is not enumerable (the `up` of `theme.breakpoints`, made with `Object.defineProperty`) survives a nested provider that sets `breakpoints`, from that provider's object when it has one, else from the one above.

## Typing your theme

A style function's `theme` needs a type. There are two ways, and they can be mixed.

### Way 1: `createStyle(theme)` infers it

`createStyle` takes the theme object and returns `styled`, `ThemeProvider`, `useTheme` and the rest, typed for that theme. Nothing else is needed:

```ts
const { styled } = createStyle(lightTheme, { prefix: 'umber' })

styled('div')(({ theme }) => ({ color: theme.palette.primary })) // theme.palette.primary is string
```

Export the returned functions from one module of your app and import them from there. This is the way the pages use.

### Way 2: direct imports and one module declaration

The functions that `@umber-style/react` exports directly (`styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply`, `themeClass`, `when`, `whenScheme`, `configure`) share one engine that is made on first use, and their theme type is the interface `Theme` of the binding, which extends the interface `Theme` of `@umber-style/core`. Both are empty until you merge your theme into one of them, once:

```tsx
import { configure, styled, ThemeProvider, useTheme } from '@umber-style/react'

export const lightTheme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

type AppTheme = typeof lightTheme

declare module '@umber-style/core' {
  interface Theme extends AppTheme {}
}

configure({ prefix: 'umber', theme: lightTheme })

export const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[2],
}))

export const App = () => (
  <ThemeProvider theme={lightTheme}>
    <Button>{useTheme().palette.primary}</Button>
  </ThemeProvider>
)
```

The declaration is derived from the object (`typeof lightTheme`), so the type and the value cannot drift apart. `configure` must run before the first use of any of these functions and throws after it; it takes the same options as `createStyle` (see [Options reference](options.md)) and the base theme.

The same works with `@umber-style/vue` and `@umber-style/react-native`. The declaration in `@umber-style/core` serves all of them, so an app that uses two bindings declares it once. A declaration in the module of a binding (`declare module '@umber-style/react' { interface Theme extends AppTheme {} }`) types that binding only (React Native has none of its own: it reads the core's), and the two can be used together: the binding's `Theme` has the members of both. See [Typed styles](typed-styles.md).

## Limits

- The shape that the first provider gave the engine stays after that provider unmounts (`engine.baseTheme`, and `engine.refs` made from it). Only what reads the theme with no provider forgets it. Give the theme to `createStyle(theme)` or `configure({ theme })` when the shape must not depend on which provider renders first.

- The module declaration names `@umber-style/core`, and TypeScript resolves that name from the file that holds the declaration. It was verified with the workspace layout of this repository. With a package manager that does not let your app see a package it did not install itself, you may need to install `@umber-style/core` directly; that was reasoned, not tried.
- `Theme` is one interface for the whole program. Two different themes in one program (two `createStyle` calls with different shapes) are typed by `createStyle`, not by `Theme`.
- With the strict style types, a key built at run time in a web style, such as the media query above, is written with `at()`: written directly it is a type error. The default types take it directly. See [Typed styles](typed-styles.md).
- A provider that changes only raw values (a breakpoint) declares nothing, and its own theme class is always `umber-theme-0`. No rule is written for it, and every such provider shares that name.
- Under a nested provider the DOM has one more element, the wrapper. It has `display: contents`, so the layout is the same, but selectors that count elements see it: a child selector (`>`), a sibling selector (`+`, `~`), `:first-child` and the like.
- Portal content without `ThemeScope` sees the outer theme (the variables of `:root`), not the theme of the nested provider above it in the tree.
- A provider inside portal content that has no `colorScheme` of its own declares none: `color-scheme` there comes from `:root`, and `whenScheme` follows the system preference.
- A theme change of the outermost provider renders no styled component when only token values change. A change of a value that is not a token (a breakpoint, an `inline` token, a function in the theme) makes a new view of the theme, and every styled component with a function style renders again, as it must. What reads `useTheme()` renders again on every change.
- The `:root` rule is written in an insertion effect in the browser, after the render. Of two React roots, the one that commits last decides, and an unmounted root leaves its theme there until another provider declares one.
- In both React builds the outermost provider is the one with no provider of its engine above it in the page, of either build. The server components build cannot see the page, so its provider renders a client component that decides where the tree is whole (see [Server rendering](server-rendering.md#server-components)). A nested provider of the server build declares only the theme it was given: it cannot know the providers between it and the root. A provider of the client build below one of the server build merges over that provider's theme, which the browser part of the server provider puts into the context, and declares its whole merged theme as usual; a member of the server provider's theme that is not plain data (a function) does not reach it, and the theme above gives that member instead.
- `isRoot` keeps working as before: no element, no class, no rule, and the class on `<html>` is yours. See [The root theme and switching](root-theme.md).
