# Testing

After this page you can tell which of three kinds of test a check belongs in, run each one on your machine, and read what the fixture apps do and do not cover.

## The three tiers

| Tier                    | Where                                                        | What runs it                           | What it is for                                                                                   |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Unit and integration | `packages/*/src/*.test.ts(x)`                                | vitest, in jsdom (or Node)             | Rule text, class names, what is inserted where. Fast, and held to 100% coverage                  |
| 2. Real browser         | `packages/core` and `packages/react`, `*.browser.test.ts(x)` | vitest browser mode, headless Chromium | What only a browser's cascade and layout decide: which rule wins, a computed value, a transition |
| 3. End to end           | `e2e/` against the apps in `fixtures/`                       | Playwright Test, headless Chromium     | A whole page from a real build: hydration, extraction, navigation, no-script, size               |

Put a check in the lowest tier that can see the thing. A claim about the text of a rule is tier 1. A claim that one rule beats another, or that a variable resolves to a value, is tier 2. A claim about what a framework does with the engine (what the first HTML holds, whether the page looks the same however you arrive at it) is tier 3.

## Running them

```sh
pnpm test:coverage        # tier 1, every package; fails below 100%
pnpm test:browser         # tier 2, in core and react
pnpm test:e2e             # tier 3, every fixture; builds each one first
E2E_FIXTURE=next-app pnpm test:e2e     # one fixture (a comma-separated list works)
```

Tiers 2 and 3 need Chromium, which Playwright installs once: `pnpm --filter @umber-style/core exec playwright install chromium`. The version of `playwright` in the packages and of `@playwright/test` in `e2e` is the same exact version, so one download serves both. Tier 2 has its own `vitest.browser.config.ts`: `pnpm test` and `pnpm test:coverage` never open a browser. In CI the `browser` job runs tier 2 for `core` and `react`, and the `e2e` job runs one matrix row for each folder of `fixtures/`; a new fixture appears in the matrix with no change to the workflow.

## Tier 2: real-browser tests

The tests build their CSS with the engine and read `getComputedStyle`. They cover:

- Cascade layers: a style given through `style` beats the component's own property and its `:hover` rule (the pointer is really moved over the element with the browser provider's `userEvent.hover`), unlayered page CSS beats the engine's, a reset in a layer declared before the engine's is beaten by components, and an unlayered reset is not.
- The base class and the props class: a property in both (props wins), a base `:hover` against a plain props property (the base wins while hovered), both defining `:hover` (props wins), and a base `@media` against a plain props property (the props class wins at every width: the difference from one merged class, written down in [Cascade layers and overrides](cascade-layers.md)).
- Theme conditions with themes A, B, A: `when(A)` applies under the first A, not under B, and again under the inner A; `whenScheme` with an explicit scheme and with the emulated system preference (the protocol command `Emulation.setEmulatedMedia`).
- Registered tokens: `@property` is accepted, a registered colour resolves, and a theme class change under a `transition` runs through values between both ends.
- `alpha()`: both declarations are written and the browser computes the `color-mix()` result.
- Nested themes: three levels each resolve their own values, and `display: contents` wrappers leave the layout of a flex parent's children as it was.

### What a registered token does in a transition

Observed in Chromium 158.0.8127.18 (the build of Playwright 1.65.0), with a `color` transition of two seconds on the element that uses the token, the animation paused at one second:

- A transition on the property that uses the token (`transition: color 2s`) runs after a theme class change, registered or not: the computed colour is halfway between the two ends (`rgb(128, 0, 128)` between blue and red). It runs because the computed colour of the element changes.
- A transition on the token itself (`transition: --umber-palette-primary 2s`, on the element that carries the theme class) runs only when the token is registered. The test sees one transition for the variable, and a colour halfway between the two ends below it. Without `registered` there is no transition and the colour jumps.

## Tier 3: the fixture apps

Each fixture is a private workspace member of `fixtures/`, built with its framework's production build and served as it would be in production. Every one renders the same small app from `fixtures/shared`: three pages (Home, Catalog, Settings), each with components the others do not use, a `Button` with variants, a `Card`, a `Flex` with a gap and direction from props, a nested `ThemeProvider` section, a style that uses a theme breakpoint, and a switch that changes the class on `<html>` and stores the choice, applied by a script in the head before the first paint.

| Fixture      | Framework and build                                                                 | How the CSS reaches the page                                                      |
| ------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `vike-ssg`   | Vike with React; every page prerendered, then client routing                        | `extractPageStyles(cache, html, { themes })` in the render hook                   |
| `next-app`   | Next.js, App Router, Turbopack; server components and client components in one page | `<style href precedence>` for each class, from both builds                        |
| `next-pages` | Next.js, Pages Router; rendered on each request                                     | `extractPageStyles` in the custom document                                        |
| `spa`        | Vite and React, client only                                                         | The browser's cache; `index.html` holds the static background and the boot script |
| `vue-ssr`    | Vite and Vue; a small Node server renders each request                              | `extractPageStyles(...).tag` after `renderToString`                               |

### The scenarios

Each is a spec file in `e2e/tests/`. A fixture lists the scenarios that apply to it in `e2e/fixtures.ts`.

| Letter | What it asserts                                                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | A direct load of each page: no console error or hydration warning, every element with an engine class has a rule that names it, every `var(--umber-*)` a matched rule uses has a value on that element                                       |
| B      | The computed styles of a page loaded directly equal those after loading another page and following the link, for every pair                                                                                                                  |
| C      | The same with the dark scheme: loaded directly with dark stored, against switching to dark and then navigating                                                                                                                               |
| D      | The engine's rule count is stable after hydration and does not grow when going back to a visited page                                                                                                                                        |
| E      | On landing, no engine rule is unused: the measure is taken with the protocol's rule usage tracking                                                                                                                                           |
| F      | With scripting disabled the page has the same computed styles as with script                                                                                                                                                                 |
| H      | The theme on `<html>` is switched, then the app navigates in the browser to a page with a component that uses a token no earlier page used: `findMissingStyles` finds nothing, and the computed colour is the value of the theme switched to |
| G      | A Lighthouse run of the production build: score, blocking time, unused CSS and JavaScript, transfer size, written to `e2e/reports/`                                                                                                          |

The helpers are in `e2e/helpers/`: `collectComputedStyles` and `expectSameStyles` (a readable diff), `collectUnusedRules`, `collectEngineRuleCount`, `checkEngineClasses`, and a console watcher that fails any test on an error or a hydration warning.

What `collectUnusedRules` leaves out, because such a rule cannot be used at load by nature: rules with `:hover`, `:focus`, `:active`, `:focus-visible` or `:focus-within`; rules inside an `@media` whose condition is false for the test's viewport; `@property` rules; the rules of theme classes (`.umber-theme-*`), which are offered for switching and are not all applied at once; and the layer order statement. It counts the rules in the text of a style element. A rule that a browser cache inserts later with `insertRule` has no text, so the measure covers what was in the HTML.

### Known failures

A test that documents behaviour the engine does not have yet is marked as a known failure through the `known` map of its fixture in `e2e/fixtures.ts`, with a reason that starts with the word KNOWN. Playwright reports it as an expected failure; when it starts to pass the run fails and the mark is removed. **There are none today**: every `known` map is empty. The three groups that were there are fixed: a page carrying the rules of other pages (`extractPageStyles` reads the page), a client component unstyled in the first HTML (the client build renders style elements on a server), and the dark theme class of the browser lacking variables that server components use (the browser reads the rules of the page and completes the classes it made).

`findMissingStyles` is the checker of `@umber-style/core`, the one that the development mode runs. The end-to-end helper carries no copy of it: it sends the compiled text of that file into the page.

## What is not covered

- React Native on a device or a simulator. The binding is tested in unit tests with a stand-in for the platform import.
- Browsers without cascade layers, `@scope`, `@property` or `color-mix()`. Only Chromium runs; the fallbacks are tested as text.
- Firefox and WebKit. Playwright can drive them, no project does.
- A bundler other than Vite and Turbopack. Next.js was built with the default bundler of its current major.
- Lighthouse in CI is a generous guard (score above 0.5, blocking time under a second, transfer under a megabyte). It is not a performance budget.

## Limits

- The fixtures hold the same few components. A defect that needs another shape of style may not show.
- Scenario G runs several times at once with the other scenarios on one machine. Its numbers are for comparison between fixtures on the same run, not absolute.
- The text of a rule that a browser cache inserted after load is not seen by the rule usage tracking: scenario E does not apply to a client-only app.
- The class on `<html>` is switched by script. A page with scripting disabled stays in the scheme that the server chose.
