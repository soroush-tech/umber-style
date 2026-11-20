# The root theme and switching

After this page you can give the whole page its theme, switch light and dark with no render of a styled component, store the choice and apply it before the first paint, add a theme while the page runs, and render a static page with its CSS.

There are two ways to put the theme of the page on the document. The default needs nothing from you: the outermost provider declares its theme on `:root`. The other is yours to drive: a theme class on `<html>`, with `isRoot` on the provider. Both work in every binding, and on one page they meet in a stated way: a class on `<html>` wins over `:root`.

## The default: the theme on `:root`

The outermost `ThemeProvider` (one with no provider above it) renders no element and puts no class on `<html>`. It declares the variables of its theme on the document root, in one rule in the `theme` layer:

```css
@layer umber-theme {
  :where(:root) {
    --umber-palette-text: #1a1a1a;
    --umber-palette-surface: #ffffff;
    --umber-space-3: 16px;
    color-scheme: light;
  }
}
```

- Everything sees the variables: the elements of the app, plain elements, portal content, and the rules for `html` and `body` that `Global` writes.
- `colorScheme` sets `color-scheme` in that rule.
- With pruning (the default) the rule declares only the variables that rules use, and grows as rules come in, like a theme class.
- A change of the provider's theme rewrites that one rule. No styled component renders again; what reads `useTheme()` does. So switching light and dark is a change of the `theme` you give the provider, for example from state.
- The selector is `:where(:root)`, whose specificity is 0: a theme class on `<html>` wins over it, whatever the order of the rules.

In the browser the rule is written in an insertion effect (React) or in `setup` and when the theme changes (Vue). On a server it is written during the render: a classic server render gets it from `extractPageStyles`, and the providers of the React builds send it as a `<style href precedence>` element, keyed `umber-root-<hash>`. See [Server rendering](server-rendering.md).

In the server components build the root theme can change from the server: a cookie and `router.refresh()`, after which the root layout renders `<ThemeProvider theme={dark}>`. React keeps a style element for the life of the document, so the element of the earlier root theme is still there. Once the new one is committed, the provider leaves one root rule of its prefix live: the one of its own theme, written again into its element when an earlier change deleted it there, and none in the other elements that React keeps for that prefix. This works with no client-side engine at all; the elements of the browser's cache and of a registry are not touched.

An engine has one root theme. Two outermost providers that share an engine (two React roots on one page, or two providers side by side with nothing above them) share the rule: the theme of the one that was written last is there, for both. See [Themes](themes.md).

What the default does not give: a marker class at the root. `when(theme)` and `whenScheme()` work with classes (see [Theme conditions](theme-conditions.md)), and `:root` has none, so below the outermost provider and outside any nested one, `when(rootTheme)` does not match and `whenScheme()` follows the system preference, whatever `colorScheme` the provider has. A page that needs either at the root uses the class on `<html>`, below.

## The class on `<html>`: `isRoot`

With `isRoot` the provider renders no element, no class and no rule. It does two things: it gives the engine its base theme (when the engine has none yet) and it feeds the context for `useTheme` and function styles. You put the class on an ancestor you control, usually `<html>`, and the call that gives you the class, `themeClass`, makes the rule: see below.

```tsx
const App = () => (
  <ThemeProvider theme={lightTheme} colorScheme="light" isRoot>
    <Page />
  </ThemeProvider>
)
```

Use it when the page switches its theme by a class on `<html>` (a script that applies a stored choice before the first paint, below), or when conditions must see the theme of the root: the class carries the boundary and scheme markers. `isRoot` is a prop of the provider in every binding. React Native accepts it and ignores it, because React Native has no classes. Providers below it are nested providers, as below any other.

A root provider makes no theme class, so its `colorScheme` makes no rule and changes nothing in the markup: the class that matters is the one you got from `themeClass(theme, colorScheme)` and put on `<html>`. Call `themeClass` for the root theme, at start-up, as for every theme you switch to. An app that never calls it has no rule for its root theme at all, and a root provider does not make one for it.

## The class string of a theme

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
import { extractPageStyles } from '@umber-style/core'
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

// The themes that no element of the body has (the one on <html>, the one it can switch to) go in `themes`.
const { tag } = extractPageStyles(cache, body, { themes: [light, dark] })

const choose = `document.documentElement.className = localStorage.getItem('theme') === 'dark' ? ${JSON.stringify(dark)} : ${JSON.stringify(light)}`

const html = [
  '<!doctype html>',
  `<html class="${light}">`,
  `<head>${tag}<script>${choose}</script></head>`,
  `<body>${body}</body>`,
  '</html>',
].join('')
```

`extractPageStyles` is called after the render and reads the finished markup, so it holds the rules of this page and of the themes you name, and nothing else. The output is one document (shown formatted):

```html
<!doctype html>
<html class="umber-theme-s44g65 umber-boundary umber-scheme-light">
  <head>
    <style data-style="umber" data-options="p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=">
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

The `data-options` attribute is the stamp of the options of the cache. A browser cache created later on the same page compares it with its own: see [Server rendering](server-rendering.md).

The head script runs while the document is still being parsed, before the body is painted, so the page has the stored theme from its first frame.

### The same page with the default provider

A page can also render the default provider (no `isRoot`): its theme is on `:root`, and the themes it offers are classes for `<html>`, as above. A class on `<html>` wins over `:root`, so the script needs to set a class only for a theme other than the default:

```tsx
const { styled, ThemeProvider, themeClass, cache } = createStyle(lightTheme, {
  prefix: 'umber',
  hasServerStyleElements: false,
})

const dark = themeClass(darkTheme, 'dark')

const body = renderToStaticMarkup(
  <ThemeProvider theme={lightTheme} colorScheme="light">
    <Page>Hello</Page>
  </ThemeProvider>
)

const { tag } = extractPageStyles(cache, body, { themes: [dark] })

const choose = `if (localStorage.getItem('theme') === 'dark') document.documentElement.className = ${JSON.stringify(dark)}`
```

The CSS of the page (shown formatted):

```css
@layer umber-theme, umber-global, umber-components, umber-overrides;
@layer umber-theme {
  :where(:root) {
    --umber-palette-text: #1a1a1a;
    --umber-palette-surface: #ffffff;
    --umber-space-3: 16px;
    color-scheme: light;
  }
}
@layer umber-theme {
  .umber-theme-tk7v2e {
    --umber-palette-text: #f2f2f2;
    --umber-palette-surface: #101114;
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
```

The body is `<main class="umber-page-root-1h3tp5s">Hello</main>`, with no wrapper. That the dark class on `<html>` wins over `:root` was checked in Chromium (`packages/react/src/themeProvider.browser.test.tsx`); the CSS above is asserted in `packages/react/src/providers.docs.ssr.test.tsx`. Under the default light theme, `whenScheme('dark')` at the root follows the system preference (see above); under the dark class it has the scheme marker. The script is an inline script: a strict content security policy needs a nonce or a hash for it. See [No inline styles](no-inline-styles.md).

## Switching at run time

With the default provider, a switch is a new `theme` for it: the `:root` rule is rewritten, and no styled component renders again, as above.

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

## Registering the themes the page offers

A theme that you switch to with a class on `<html>` is known to the engine of the browser only if the code of the browser asked for its class. Nothing renders a provider for it, so without that the engine would not know the theme exists, and a token that is first used after a navigation (a page with a component that no earlier page showed) would have no value under it.

The call is `themeClass(theme, colorScheme)`, the same one the build makes. Put it in the module that both the server and the browser import, or in the client entry, for every theme the page offers:

```ts
// style.ts, imported by the server and by the client entry
export const lightClass = themeClass(lightTheme, 'light')
export const darkClass = themeClass(darkTheme, 'dark')
```

A registered theme class is completed as rules arrive: when a rule first uses a variable, the variable is appended to every registered class that declares it, whether the rule came from a component that rendered in the browser or from a style element that the server or the framework added to the page (the engine reads those too). End-to-end scenario H runs this in every fixture: land on a page, switch to dark, navigate in the browser to a page with a component that uses a token that no earlier page used, and check with `findMissingStyles` and the computed colour that it has its value.

## Client-only apps

A client-only app has no server HTML. Before the engine runs, the page holds only `index.html`, so the file must carry what the first paint needs, as static CSS and a script:

- a `<style>` with the background of each scheme: `html { background-color }`, an `html[data-scheme='dark']` rule, and a `prefers-color-scheme: dark` rule for `html:not([data-scheme])`, so that the page has the right background with no script and before the engine's rules exist;
- a small inline script in the head that reads the stored choice and sets `data-scheme` on `<html>`, before the first paint.

The `spa` fixture does exactly this (`fixtures/spa/index.html`), and end-to-end tests check that the static background of each scheme is in `index.html`, that the script is before the body, that the page background is right with scripting disabled for both schemes, and that the stored scheme is on `<html>` before the body exists. The engine then puts the theme class on `<html>` from its entry, before the first render. These pages are not styled until script runs, so where a good Lighthouse score matters, prerender the shell (the app frame and its first route) with a classic server render as above: the first paint then has all its CSS in the HTML.

## Limits

- With the default provider, `when(rootTheme)` does not match at the root and `whenScheme()` follows the system preference there: `:root` carries no marker class. Use `isRoot` and a class on `<html>` for conditions at the root.
- One engine has one `:root` rule. Two outermost providers of one engine with different themes (two React roots) share it: the last one written wins, for both.
- `extractPageStyles` takes the root theme that the cache declared last, so render and extract one page before the next one starts. The style elements of the React builds carry their root theme with them and do not depend on this.
- In the server components build, after the root theme changed from the server, the root rule of the earlier theme is deleted from the element that React keeps once the new provider has committed (a layout effect, before the paint); until then both are in the document and the later one wins by its place. The pass reads the elements that React hoisted for the prefix (`data-precedence`) only. Two outermost providers side by side each leave their own rule alone in turn: the one that committed last wins.
- The `:root` rule of a server render is removed from the page, where the browser kept it as it was sent, when the browser cache declares its own root theme, at hydration. A rule the browser could not tell apart (its style element lost a rule) stays, and a later rule with the same selector wins over it only by its place in the document.
- "No flash" is reasoned from the order of events (the script runs before the first paint). It was not observed in a browser.
- The switch was checked in jsdom, which resolves custom properties from classes on an ancestor. A real browser was not used.
- The inline script needs a content security policy nonce or hash. The engine has no option to produce one.
- With `isRoot`, the provider renders no wrapper, no theme class and makes no theme rule, and no `:root` rule. If the class is not on an ancestor, or `themeClass` was not called for it, the variables are not declared and styles that use them have no values.
- Scenario H was run on Chromium only, on the fixtures' own theme switch (a class on `<html>`).
- The server components build handles `isRoot` too: it sends the `<style>` of the theme classes that `themeClass` already made for its theme object, and makes none; see [Server rendering](server-rendering.md).
