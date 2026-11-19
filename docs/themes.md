# Themes

After this page you can give a subtree its own theme, read theme values in JavaScript, know what a style function sees as `theme`, and type your theme in two ways.

## The provider

`ThemeProvider` takes a theme and makes it the theme of everything below it. On the web it renders one element, and that element carries the theme's class so that the variables apply below it:

```html
<div class="umber-theme-1x8aice umber-boundary umber-scope">...</div>
```

- `umber-theme-<hash>` is the theme class: it declares the theme's variables. The hash is of the declarations.
- `umber-boundary` marks an element that starts a theme. [Theme conditions](theme-conditions.md) use it.
- `umber-scheme-light` or `umber-scheme-dark` is added when you pass `colorScheme="light"` or `"dark"`.
- `umber-scope` has `display: contents`, so the wrapper takes no space in the layout. It is a class, not an inline style.

The `theme` prop is a partial theme. A nested provider gives only what it changes and the rest comes from the provider above:

```tsx
import { createStyle } from '@umber-style/react'
import type { WebStyleObject } from '@umber-style/core'

const lightTheme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a', surface: '#ffffff' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider, useTheme } = createStyle(lightTheme, { prefix: 'umber' })

const Card = styled('div', { name: 'Card' })(({ theme }) => {
  const wide: Record<`@media ${string}`, WebStyleObject> = {
    [`@media (min-width: ${theme.breakpoints[0]})`]: { padding: theme.space[3] },
  }
  return { color: theme.palette.text, backgroundColor: theme.palette.surface, ...wide }
})

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
<div class="umber-theme-1x8aice umber-boundary umber-scope">
  <div class="umber-card-root-c45tr"></div>
  <div class="umber-theme-1lpp26f umber-boundary umber-scope">
    <div class="umber-card-root-c45tr"></div>
  </div>
  <div class="umber-theme-0 umber-boundary umber-scope">
    <div class="umber-card-root-1h3unrm"></div>
  </div>
  <div class="umber-theme-45hmwp umber-boundary umber-scope"><code>#0b7a4b</code></div>
</div>
```

```css
.umber-card-root-c45tr {
  color: var(--umber-palette-text);
  background-color: var(--umber-palette-surface);
}
@media (min-width: 600px) {
  .umber-card-root-c45tr {
    padding: var(--umber-space-3);
  }
}
.umber-theme-1x8aice {
  --umber-palette-text: #1a1a1a;
  --umber-palette-surface: #ffffff;
  --umber-space-3: 16px;
}
.umber-theme-1lpp26f {
  --umber-palette-surface: #fff4d6;
}
.umber-card-root-1h3unrm {
  color: var(--umber-palette-text);
  background-color: var(--umber-palette-surface);
}
@media (min-width: 480px) {
  .umber-card-root-1h3unrm {
    padding: var(--umber-space-3);
  }
}
```

(Each rule is inside its cascade layer; the layers are left out here.)

- The second provider changes one token. Its theme class declares one variable, and the Card inside has the same class as the first, because only a variable changed.
- The third provider changes a breakpoint. A breakpoint is not a token (see below), so it is written into the media rule and the Card inside has its own class. The provider's class is `umber-theme-0`: it has nothing to declare, so no rule is written for it.

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

| Binding      | `useTheme()` returns                             |
| ------------ | ------------------------------------------------ |
| React        | the theme                                        |
| React Native | the theme                                        |
| Vue          | a computed ref of the theme (`useTheme().value`) |

With no provider above, `useTheme()` returns the base theme.

## The base theme

The engine needs one full theme to know its shape: which tokens exist and what their variables are called. It is the base theme. It comes from the first of these:

- `createStyle(theme)`, or `createEngine(theme)`.
- `configure({ theme })`, for the default style.
- The first `ThemeProvider` that renders, or the first `themeClass(theme)` call, when none of the above was used. That theme becomes the base, so give the full theme to the outermost provider, not a partial one.

A style function, a function sheet or `useTheme` that runs before any base theme exists throws: `There is no theme yet: render a ThemeProvider with the full theme first, or call setTheme (or configure({ theme })) before a function style, a sheet or useTheme is used.`

Arrays are replaced as a whole in the real values: a provider with `{ space: [0, 8] }` makes `useTheme().space` that two-item array. The variables are per item, so only `--umber-space-0` and `--umber-space-1` are redeclared and `--umber-space-2` and `--umber-space-3` keep the outer values. If you need to change an array, give all of it.

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

The functions that `@umber-style/react` exports directly (`styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply`, `themeClass`, `when`, `whenScheme`, `configure`) share one engine that is made on first use, and their theme type is the interface `Theme` of `@umber-style/core`. It is empty until you merge your theme into it, once:

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

The same works with `@umber-style/vue` and `@umber-style/react-native`. One `Theme` interface serves all of them, so an app that uses two bindings declares it once.

## Limits

- The module declaration names `@umber-style/core`, and TypeScript resolves that name from the file that holds the declaration. It was verified with the workspace layout of this repository. With a package manager that does not let your app see a package it did not install itself, you may need to install `@umber-style/core` directly; that was reasoned, not tried.
- `Theme` is one interface for the whole program. Two different themes in one program (two `createStyle` calls with different shapes) are typed by `createStyle`, not by `Theme`.
- A key built at run time in a style, such as the media query above, needs the `Record<...>` form shown. See [Typed styles](typed-styles.md).
- A provider that changes only raw values (a breakpoint) declares nothing, and its theme class is always `umber-theme-0`. No rule is written for it, and every such provider shares that name.
