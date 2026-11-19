# The root theme and switching

After this page you can switch light and dark with no render, store the choice and apply it before the first paint, add a theme while the page runs, and render a static page with its CSS.

## Why a root provider

A normal `ThemeProvider` renders an element that carries its theme's class, and that class declares the whole theme for everything below it. If your app also puts a theme class on `<html>` to switch themes, the wrapper of the outermost provider would override it for the entire page, and the switch would do nothing.

So the outermost provider is a root provider. With `isRoot` it renders no element, no class and no rule. It does two things: it gives the engine its base theme (when the engine has none yet) and it feeds the context for `useTheme` and function styles. You put the class on an ancestor you control, usually `<html>`, and the call that gives you the class, `themeClass`, makes the rule: see below.

```tsx
const App = () => (
  <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
    <Page />
  </ThemeProvider>
)
```

`isRoot` is a prop of the provider in every binding. React Native accepts it and ignores it, because React Native has no classes. Nested providers stay normal: they change only the tokens they give, below their own element.

A root provider makes no theme class, so its `colorScheme` makes no rule and changes nothing in the markup: the class that matters is the one you got from `themeClass(theme, colorScheme)` and put on `<html>`. Call `themeClass` for the root theme, at start-up, as for every theme you switch to. An app that never calls it has no rule for its root theme at all, and a root provider does not make one for it.

## The class on `<html>`

`themeClass(theme, colorScheme)` returns the class string for a theme: the theme class, `umber-boundary`, and `umber-scheme-light` or `umber-scheme-dark` for those two schemes:

```ts
themeClass(lightTheme, 'light') // 'umber-theme-s44g65 umber-boundary umber-scheme-light'
themeClass(darkTheme, 'dark') //   'umber-theme-tk7v2e umber-boundary umber-scheme-dark'
```

Calling it makes the rule of the theme class, so call it for each theme you will switch between, once, at start-up. The class name is a hash of the theme's declarations, so the server and the browser produce the same names for the same themes.

A theme class on `<html>` replaces the one that was there: only one of them applies at a time. A token that the dark theme does not give is not declared under the dark class, so a style that uses it has no value. Give the theme you switch to every token the page uses. A class declares only the variables that some rule uses: see [Tokens](tokens.md).

## A static page, with the choice applied before the first paint

This renders a whole page to a string with no React on the client. The page holds the CSS, `<html>` has the default class, and a script in the head applies the stored choice before the first paint:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { createStyleTag } from '@umber-style/core'
import { createStyle } from '@umber-style/react'

const lightTheme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a', surface: '#ffffff' },
  space: [0, 4, 8, 16],
}
const darkTheme = {
  ...lightTheme,
  palette: { primary: '#8ab4ff', text: '#f2f2f2', surface: '#101114' },
}

const { styled, ThemeProvider, themeClass, cache } = createStyle(lightTheme, {
  prefix: 'umber',
})

const light = themeClass(lightTheme, 'light')
const dark = themeClass(darkTheme, 'dark')

const Page = styled('main', { name: 'Page' })(({ theme }) => ({
  backgroundColor: theme.palette.surface,
  color: theme.palette.text,
  padding: theme.space[3],
}))

const body = renderToStaticMarkup(
  <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
    <Page>Hello</Page>
  </ThemeProvider>
)

const choose = `document.documentElement.className = localStorage.getItem('theme') === 'dark' ? ${JSON.stringify(dark)} : ${JSON.stringify(light)}`

const html = [
  '<!doctype html>',
  `<html class="${light}">`,
  `<head>${createStyleTag(cache)}<script>${choose}</script></head>`,
  `<body>${body}</body>`,
  '</html>',
].join('')
```

`createStyleTag(cache)` is called after the render, so it holds every rule the page used. The output is one document (shown formatted):

```html
<!doctype html>
<html class="umber-theme-s44g65 umber-boundary umber-scheme-light">
  <head>
    <style
      data-style="umber"
      data-ids="umber-theme-s44g65 umber-layers umber-theme-tk7v2e umber-page-root-1h3tp5s --umber-palette-surface --umber-palette-text --umber-space-3"
    >
      @layer umber-theme, umber-global, umber-components, umber-overrides;
      @layer umber-theme {
        .umber-theme-s44g65 {
          --umber-palette-surface: #ffffff;
          --umber-palette-text: #1a1a1a;
          --umber-space-3: 16px;
          color-scheme: light;
        }
      }
      @layer umber-theme {
        .umber-theme-tk7v2e {
          --umber-palette-surface: #101114;
          --umber-palette-text: #f2f2f2;
          --umber-space-3: 16px;
          color-scheme: dark;
        }
      }
      @layer umber-components {
        .umber-page-root-1h3tp5s {
          background-color: var(--umber-palette-surface);
          color: var(--umber-palette-text);
          padding: var(--umber-space-3);
        }
      }
    </style>
    <script>
      document.documentElement.className =
        localStorage.getItem('theme') === 'dark'
          ? 'umber-theme-tk7v2e umber-boundary umber-scheme-dark'
          : 'umber-theme-s44g65 umber-boundary umber-scheme-light'
    </script>
  </head>
  <body>
    <main class="umber-page-root-1h3tp5s">Hello</main>
  </body>
</html>
```

The `data-ids` attribute lists what the style element already holds. It matters if a browser cache is created later on the same page: see [Server rendering](server-rendering.md).

The head script runs while the document is still being parsed, before the body is painted, so the page has the stored theme from its first frame. The script is an inline script: a strict content security policy needs a nonce or a hash for it. See [No inline styles](no-inline-styles.md).

## Switching at run time

With the class on `<html>`, a switch is a class change. No component re-renders and no style is recomputed:

```ts
function setThemeName(name: 'light' | 'dark') {
  document.documentElement.className = name === 'dark' ? dark : light
  localStorage.setItem('theme', name)
}
```

In a document loaded with the page above, the computed value of `--umber-palette-surface` under the `light` class is `#ffffff` and under the `dark` class `#101114`. That was checked in jsdom with the real rules.

To follow the system setting when nothing is stored, read `matchMedia('(prefers-color-scheme: dark)').matches` in the same script. That is plain browser API and is not part of the engine.

## Adding a theme at run time

A theme class is made when you ask for it, so a new theme needs no build and no render:

```ts
const brand = { palette: { surface: '#fff4d6' } }
const section = document.createElement('section')
section.className = themeClass(brand)
```

`themeClass(brand)` inserts the rule of the theme (`.umber-theme-1lpp26f{--umber-palette-surface:#fff4d6;}`) into the style element and returns `umber-theme-1lpp26f umber-boundary`. Everything below `section` that uses `--umber-palette-surface` now has the new value, and the rest comes from the theme above.

The same works for any element, in any binding, since the class is plain: `getEngine().themeClass(...)` on the default style, or `themeClass` from `createStyle`.

## Limits

- "No flash" is reasoned from the order of events (the script runs before the first paint). It was not observed in a browser.
- The switch was checked in jsdom, which resolves custom properties from classes on an ancestor. A real browser was not used.
- The inline script needs a content security policy nonce or hash. The engine has no option to produce one.
- With `isRoot`, the provider renders no `umber-scope` wrapper, no theme class and makes no theme rule. If the class is not on an ancestor, or `themeClass` was not called for it, the variables are not declared and styles that use them have no values.
- The server components build handles `isRoot` too: it sends the `<style>` of the theme classes that `themeClass` already made for its theme object, and makes none; see [Server rendering](server-rendering.md).
