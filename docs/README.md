# UmberStyle documentation

UmberStyle is a styling engine for React, React Native, Vue and plain JavaScript. Every theme token becomes a CSS variable, so a style is the same for every theme and is computed once. A theme is a class on an element: switching it re-renders nothing. React Native has no CSS, so there the same API hands your styles the real values.

**Status:** UmberStyle is at version 0.2.0 and the API can still change. How the packages reach npm, and how to try a prerelease, is in [Releasing](releasing.md).

These pages are the one set of documentation for every package below. A documentation site will be built from them later; until then they are read in this folder.

## Pages

| Page                                                            | What you can do after reading it                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)                           | Install a package and render a themed button on any platform                                                         |
| [How it works](how-it-works.md)                                 | Follow a style object to a CSS rule, read the text format of a rule, and see why one class serves every theme        |
| [Writing styles](writing-styles.md)                             | Use `styled`, labels, function styles, `shouldForwardProp`, `as` and wrapping                                        |
| [Prop filters](prop-filters.md)                                 | Keep the props of a component off the element on each platform with `@umber-style/is-prop-valid`                     |
| [Style sheets and the style prop](style-sheets.md)              | Share styles with `StyleSheet`, `useStyle` and `apply`, and override a component                                     |
| [Themes](themes.md)                                             | Nest providers, read values, and type your theme                                                                     |
| [The root theme and switching](root-theme.md)                   | Switch light and dark with no render, add a theme at run time, render a static page                                  |
| [Theme conditions](theme-conditions.md)                         | Write a rule that applies only in one theme or colour scheme                                                         |
| [Tokens](tokens.md)                                             | Do arithmetic on tokens, use `alpha`, pick token modes, animate tokens                                               |
| [Animations and global styles](animations-and-global-styles.md) | Define an animation with `keyframes`, write `body` rules and resets with `globalStyles` and `Global`                 |
| [Cascade layers and overrides](cascade-layers.md)               | Know which style wins, and fit your own CSS and resets around the engine's                                           |
| [Typed styles](typed-styles.md)                                 | Know what each platform's types catch and what they do not                                                           |
| [Server rendering](server-rendering.md)                         | Render on the server, extract CSS, hydrate, and use server components                                                |
| [The cache and server packages](cache-and-server.md)            | Make a cache with `createCache`, write a registry for the App Router, extract the CSS of a page in chunks            |
| [React](react.md)                                               | Use what is specific to the React binding                                                                            |
| [Vue](vue.md)                                                   | Use what is specific to the Vue binding                                                                              |
| [React Native](react-native.md)                                 | Use what is specific to the React Native binding                                                                     |
| [Plain JavaScript](plain-javascript.md)                         | Use the engine with no framework                                                                                     |
| [Class names without a theme](css.md)                           | Make class names from styles with `@umber-style/css`: no framework, no theme, no provider                            |
| [Working with styled-system](styled-system.md)                  | Use `@soroush.tech/styled-system` parsers and variants, and know the gaps                                            |
| [No inline styles](no-inline-styles.md)                         | Understand the guarantee, its one caveat, and what a content security policy needs                                   |
| [Options reference](options.md)                                 | Look up every option and prop: name, type, default and effect                                                        |
| [Browser and platform support](browser-support.md)              | See which browser features each part of the output needs                                                             |
| [Testing](testing.md)                                           | Choose the tier of a test, run the browser tests and the fixture apps, turn the development checks on, read the gaps |
| [Benchmarks](benchmarks.md)                                     | Run the benchmark suite in its sandbox, read its table, and know which figures are steady                            |
| [Releasing](releasing.md)                                       | Publish the packages through alpha, rc and stable, install a prerelease, and verify a tarball                        |

## The packages

| Package                      | What it is                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@umber-style/core`          | The engine: tokens, the class cache, theme classes. It knows no framework                                       |
| `@umber-style/react`         | `styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply` for React                              |
| `@umber-style/react-native`  | The same names for React Native, over the real theme values                                                     |
| `@umber-style/vue`           | The same names for Vue, with a reactive `useTheme`                                                              |
| `umber-style`                | Re-exports the core at its root and each binding as `umber-style/react`, `/react-native`, `/vue`                |
| `@umber-style/css`           | Class names from styles, with no framework and no theme: `css`, `cx`, `keyframes`, `injectGlobal`               |
| `@umber-style/cache`         | `createCache({ key })`: the engine's cache with the members a server-rendering set-up reads                     |
| `@umber-style/server`        | `@umber-style/server/create-instance`: the CSS of one page as chunks and `<style data-umber>` tags              |
| `@umber-style/is-prop-valid` | `/react`, `/vue`, `/react-native`: whether a prop is one that an element of that platform takes (no root entry) |
| `@umber-style/styled`        | Legacy: the `styled` of `@umber-style/react` as a default export, for code that imports it that way             |

## How these pages were checked

The CSS and HTML that these pages show as output come from real runs, with the prefix `umber`, or the key of the test an example was copied from (`app`, `soroush`, `css`). The CSS is shown as the engine writes it (`.a{color:red;}`: no space after a colon, no line break; see [How it works](how-it-works.md#the-text-of-a-rule)), one rule on a line; the markup around it is shown with line breaks added for reading. Class names, hashes and values are exact. The hashes depend on the theme and the styles of each example, so yours will differ.

Every code example was compiled with the repository's TypeScript and run against the packages, or copied from a passing test. Where a statement rests on reasoning only, or on something that no test in the repository runs, the page says so in its "Limits" section.

The server components build runs in the Next.js App Router fixture, and `Global` and `keyframes` run end to end in every fixture app (see [Testing](testing.md)). These run in a real browser (`pnpm test:browser`):

- The transitions of registered tokens: `registered.browser.test.ts` checks that `@property` is accepted and a registered colour computes to a colour, that a colour transition on an element that uses the token is half way between both ends after a theme class change, that the token itself transitions on the element that carries the theme class, and that without registration the colour jumps.
- The theme of the outermost provider on `:root`: `themeProvider.browser.test.tsx` checks that `<html>`, `<body>` and a `Global` rule for `body` see it, that a change of the theme switches every element, that a theme class on `<html>` wins over it, and that portal content reaches a nested provider's theme through `ThemeScope`.
- Global rules and animations: `global.browser.test.ts`, `Global.browser.test.tsx` and `keyframes.browser.test.ts` check that a rule for `body` applies, loses to a component and is gone after its release, that a rule from a server page is taken over and not written again, and that a registered animation runs.
- `hasValueRepair` (`valueRepair.browser.test.ts`: the repaired forms compute, the raw forms are dropped) and the development checker's question to `CSS.supports` (`unsupported.browser.test.ts`, `border-color: light` named with the label of its class too).
- The two ways a DOM sheet writes (`sheetText.browser.test.ts`): by text, an element for each rule, and with `insertRule`, the layers of a global rule, a component and an override give the same computed values, a released global rule leaves the cascade, and a root theme written anew is the one that applies, with one root rule live; 1600 rules by text are 1600 elements in order, each readable, a removed rule takes its element, and the time stays within a small factor of `insertRule`.

## Limits

Some things have never been run: the React Native binding in a real app; `@umber-style/cache` and `@umber-style/server` in a real app or a real browser (the registry of [The cache and server packages](cache-and-server.md) runs in a unit test, with stand-ins for the framework's hook); and `@umber-style/css` in a real browser. The pages that depend on them say it.
