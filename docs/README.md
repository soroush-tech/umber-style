# UmberStyle documentation

UmberStyle is a styling engine for React, React Native, Vue and plain JavaScript. Every theme token becomes a CSS variable, so a style is the same for every theme and is computed once. A theme is a class on an element: switching it re-renders nothing. React Native has no CSS, so there the same API hands your styles the real values.

**Status:** UmberStyle is at version 0.1.0 and the API can still change. How the packages reach npm, and how to try a prerelease, is in [Releasing](releasing.md).

These pages are the one set of documentation for all five packages. A documentation site will be built from them later; until then they are read in this folder.

## Pages

| Page                                               | What you can do after reading it                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)              | Install a package and render a themed button on any platform                                  |
| [How it works](how-it-works.md)                    | Follow a style object to a CSS rule, and see why one class serves every theme                 |
| [Writing styles](writing-styles.md)                | Use `styled`, labels, function styles, `shouldForwardProp`, `as` and wrapping                 |
| [Style sheets and the style prop](style-sheets.md) | Share styles with `StyleSheet`, `useStyle` and `apply`, and override a component              |
| [Themes](themes.md)                                | Nest providers, read values, and type your theme                                              |
| [The root theme and switching](root-theme.md)      | Switch light and dark with no render, add a theme at run time, render a static page           |
| [Theme conditions](theme-conditions.md)            | Write a rule that applies only in one theme or colour scheme                                  |
| [Tokens](tokens.md)                                | Do arithmetic on tokens, use `alpha`, pick token modes, animate tokens                        |
| [Cascade layers and overrides](cascade-layers.md)  | Know which style wins, and fit your own CSS and resets around the engine's                    |
| [Typed styles](typed-styles.md)                    | Know what each platform's types catch and what they do not                                    |
| [Server rendering](server-rendering.md)            | Render on the server, extract CSS, hydrate, and use server components                         |
| [React](react.md)                                  | Use what is specific to the React binding                                                     |
| [Vue](vue.md)                                      | Use what is specific to the Vue binding                                                       |
| [React Native](react-native.md)                    | Use what is specific to the React Native binding                                              |
| [Plain JavaScript](plain-javascript.md)            | Use the engine with no framework                                                              |
| [Working with styled-system](styled-system.md)     | Use `@soroush.tech/styled-system` parsers and variants, and know the gaps                     |
| [No inline styles](no-inline-styles.md)            | Understand the guarantee, its one caveat, and what a content security policy needs            |
| [Options reference](options.md)                    | Look up every option and prop: name, type, default and effect                                 |
| [Browser and platform support](browser-support.md) | See which browser features each part of the output needs                                      |
| [Testing](testing.md)                              | Choose the tier of a test, run the browser tests and the fixture apps, read the gaps          |
| [Benchmarks](benchmarks.md)                        | Run the benchmark suite in its sandbox, read its table, and know which figures are steady     |
| [Releasing](releasing.md)                          | Publish the packages through alpha, rc and stable, install a prerelease, and verify a tarball |

## The packages

| Package                     | What it is                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `@umber-style/core`         | The engine: tokens, the class cache, theme classes. It knows no framework                        |
| `@umber-style/react`        | `styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply` for React               |
| `@umber-style/react-native` | The same names for React Native, over the real theme values                                      |
| `@umber-style/vue`          | The same names for Vue, with a reactive `useTheme`                                               |
| `umber-style`               | Re-exports the core at its root and each binding as `umber-style/react`, `/react-native`, `/vue` |

## How these pages were checked

The CSS and HTML that these pages show as output come from real runs, with the prefix `umber`. They are shown with line breaks and spaces added for reading: the engine writes CSS compactly (`.a{color:red;}`, no spaces after colons, no line breaks). Class names, hashes and values are exact. The hashes depend on the theme and the styles of each example, so yours will differ.

Every code example was compiled with the repository's TypeScript and run against the packages, or copied from a passing test. Where a statement rests on reasoning only, or on something that no test in the repository runs, the page says so in its "Limits" section.

One thing has never been run: the React Native binding in a real app. The server components build runs in the Next.js App Router fixture, and the transitions of registered tokens run in a browser: `registered.browser.test.ts` checks that `@property` is accepted and a registered colour computes to a colour, that a colour transition on an element that uses the token is half way between both ends after a theme class change, that the token itself transitions on the element that carries the theme class, and that without registration the colour jumps. The page that depends on the first says it.
