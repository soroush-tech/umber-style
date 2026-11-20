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
pnpm test:e2e:dev         # tier 3 against development servers; see "Tier 3 in development"
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
- The development checker and the browser's `CSS.supports`: a property that Chromium does not have (`elevation: 2`, written `elevation:2px`) is dropped from the inserted rule and warned about once, with its class; `-moz-osx-font-smoothing` and `width: '-moz-available'`, which Chromium does not have either, are not; neither is `-moz-box`, the first item of `display: ['-moz-box', 'flex']`, while a last item that Chromium rejects is; and for `elevation: 'var(--anything)'` the warning comes from the property, not the value.

### What a registered token does in a transition

Observed in Chromium 158.0.8127.18 (the build of Playwright 1.65.0), with a `color` transition of two seconds on the element that uses the token, the animation paused at one second:

- A transition on the property that uses the token (`transition: color 2s`) runs after a theme class change, registered or not: the computed colour is halfway between the two ends (`rgb(128, 0, 128)` between blue and red). It runs because the computed colour of the element changes.
- A transition on the token itself (`transition: --umber-palette-primary 2s`, on the element that carries the theme class) runs only when the token is registered. The test sees one transition for the variable, and a colour halfway between the two ends below it. Without `registered` there is no transition and the colour jumps.

## Tier 3: the fixture apps

Each fixture is a private workspace member of `fixtures/`, built with its framework's production build and served as it would be in production. Every one renders the same small app from `fixtures/shared`: three pages (Home, Catalog, Settings), each with components the others do not use, a `Button` with variants, a `Card`, a `Flex` with a gap and direction from props, a nested `ThemeProvider` section, a style that uses a theme breakpoint, and a switch that changes the class on `<html>` and stores the choice, applied by a script in the head before the first paint. The shell renders global base styles with `Global` (a `body` rule with tokens, a rule for `#app-root`, a media query from a breakpoint, two `@font-face` rules of a local font), and a frame switch mounts and unmounts a second `Global` (a top border of `body` in the primary colour), which is on at first. The home page has two animated components: `Spinner` names its `keyframes` inside the `animation` shorthand, `Pulse` in `animationName` with steps that read tokens. They animate `transform` and `outline-color`, which the scenarios do not compare. The Vue fixture has the same, in its own sources.

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
| I      | The first HTML of home, scripting disabled: the global rules are in the engine's styles once each, `body` and `#app-root` have their computed global style, and both animations run, each with one `@keyframes` rule of its registered name  |
| J      | With script, after hydration and after a round trip through the pages: the same, no global rule and no `@keyframes` rule twice                                                                                                               |
| K      | The frame switch unmounts its `Global`: the rule is gone from the sheets and from the computed style of `body`; mounted again, it is back once. On a server-rendered page the rule that is removed is the one that came with the page        |
| L      | A theme switch on `<html>`: the global rules that read tokens follow it, with no reload                                                                                                                                                      |

Scenario I runs on the fixtures with a first HTML, J, K and L on all five. Removal on unmount is shown through the frame switch and not through a navigation, because every fixture keeps the shell mounted across its pages, and a `Global` of one page would make scenario D's count go down when that page is left. The Next.js App Router fixture also checks the case where nothing is removed: a `Global` that a server component renders on `/stream` stays in the head after a client-side navigation to home, because React keeps the style element for the life of the document (`next-app.spec.ts`, check (vi)).

The helpers are in `e2e/helpers/`: `collectComputedStyles` and `expectSameStyles` (a readable diff), `collectUnusedRules`, `collectEngineRuleCount`, `collectKeyframesAndGlobals` (the `@keyframes` rules and the rules of the global layer that the browser parsed), `checkEngineClasses`, and a console watcher that fails any test on an error or a hydration warning.

What `collectUnusedRules` leaves out, because such a rule cannot be used at load by nature: rules with `:hover`, `:focus`, `:active`, `:focus-visible` or `:focus-within`; rules inside an `@media` whose condition is false for the test's viewport; `@property` rules; the rules of theme classes (`.umber-theme-*`), which are offered for switching and are not all applied at once; the layer order statement; the steps of a `@keyframes` rule, which an animation uses and no element matches; and `@font-face` rules, which declare a font. It counts the rules in the text of a style element. A rule that a browser cache inserts later with `insertRule` has no text, so the measure covers what was in the HTML.

### Known failures

A test that documents behaviour the engine does not have yet is marked as a known failure through the `known` map of its fixture in `e2e/fixtures.ts`, with a reason that starts with the word KNOWN. Playwright reports it as an expected failure; when it starts to pass the run fails and the mark is removed. **There are none today**: every `known` map is empty. The three groups that were there are fixed: a page carrying the rules of other pages (`extractPageStyles` reads the page), a client component unstyled in the first HTML (the client build renders style elements on a server), and the dark theme class of the browser lacking variables that server components use (the browser reads the rules of the page and completes the classes it made).

`findMissingStyles` is the checker of `@umber-style/core`, the one that the development mode runs. The end-to-end helper carries no copy of it: it sends the compiled text of that file into the page.

### The development checker

With `hasDevChecks` (on in development where there is a `document`, see [Options](options.md)) the cache checks the page after start-up, when it inserts rules and when style elements arrive, throttled, and warns once for each message, with the prefix of the engine: `[umber] ...`. It reports:

- An element with a class of the engine that no rule names (`findMissingStyles`).
- A variable of the engine that a rule matching the element uses without a fallback, and that has no value on the element.
- A global rule for `html`, `body` or `:root` whose variables have no value there: no outermost provider declares its theme on `:root`, and no theme class is on `<html>`.
- A declaration of a rule that the cache inserted, or of a global rule it wrote, that the browser does not support, asked with `CSS.supports`: `[umber] the class umber-x1 declares elevation:2px, which this browser does not support`. A global rule is named by its selector, a step of `@keyframes` by the name of the animation.

What it does not report:

- A property with a vendor prefix (`-webkit-`, `-moz-`, `-ms-`, `-o-`): a declaration written for another browser is not a mistake. A custom property (`--x`) takes any value.
- A value that starts with a vendor prefix, a keyword or a function (`width: '-moz-available'`, `-webkit-linear-gradient(...)`), with or without `!important`: written for another browser too.
- The earlier items of a fallback list: only the last declaration of a property in a rule is asked about.
- The value of a declaration that holds `var(`: such a value is valid until it is used, so the browser is asked whether it knows the property at all.
- Anything about declarations where `CSS.supports` is missing, throws, or does not answer like a browser: a server, and jsdom, which answers from a table of its own.
- The descriptors of `@property` and `@font-face`, and `!important`, which is left out of the question.
- A rule that the browser rejects as a whole (a selector or an at-rule it does not know, such as `@scope` in a browser without it): the sheet skips it without a word, as before. Its declarations are still asked about.
- The rules that reach the page in style elements (written by a server, or rendered by React and hoisted into the head): the cache does not insert them, so they are not asked about.

## Tier 3 in development

The scenarios above run each fixture as a production build. The development tier starts three of them with their development servers instead: `vike-ssg` (Vike's development server), `next-app` (`next dev`, App Router) and `spa` (the Vite development server). The fixtures that have one say so with a `devPort` in `e2e/fixtures.ts` (the production port plus 100), and a `dev` script in their `package.json`. The specs are in `e2e/dev-tests/`, and the configuration is `e2e/playwright.dev.config.ts`, so `pnpm test:e2e` is unchanged and does not run them.

```sh
pnpm test:e2e:dev                      # the three development servers
E2E_FIXTURE=spa pnpm test:e2e:dev      # one fixture (a comma-separated list works)
```

The tier runs one test at a time, because the hot replacement tests write files that all three fixtures share, and a global setup loads every page of every server once first, so that a test meets a server that has compiled and optimized what it needs. Every test fails on a console error, an uncaught error, any message that mentions hydration, and any warning of the engine's own development checker (`[umber] ...`).

| Spec                      | What it asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hydration.spec.ts`       | Each page loads with no hydration message or error, in four ways: light, dark stored, light stored, and the system's dark preference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `strict-mode.spec.ts`     | The app renders under React strict mode (the fiber of the app root has the strict bits). A known element of each page has one rule for each of its classes and no class twice, no rule appears twice in the engine's sheets, a second round trip through the pages writes no rule, and no second watch on `<head>` starts                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `hot-replacement.spec.ts` | A value is edited in a source file while the server runs, for a `styled()` component and for a `StyleSheet.create` entry: the element gets the new computed value, its old class is gone, `window` keeps its marker and the document keeps its start time (no reload), and `findMissingStyles` finds nothing. Each file is put back after the test, written again until the page shows its old value without a reload (a development server that has just handled one write can miss the next). The steps of a `keyframes` are edited too (the spinner gets a new animation name, its one `@keyframes` rule has the new step, and the animation runs), and the style of the frame's `Global`, a client component (`body` gets the new value, and the frame rule is there once) |
| `dev-checks.spec.ts`      | On a healthy page the development checker (`hasDevChecks`, on in development) and `findMissingStyles` report nothing, and the checker is on: a class that no rule names is warned about once. A fake clock that keeps running moves past the checker's wait at once                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `navigation.spec.ts`      | Every pair of pages, followed in the browser, has the computed styles of the target loaded directly and no missing style; a theme that was switched is the theme that the next page shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

`fixtures/shared/src/components.tsx` exports components only: its `keyframes` names stay in the module, and each `globalStyles` handle is rendered by a component of its own there. A module that also exports other values is not one that React's fast refresh replaces in place; an edit of it would go on to the modules that import it. A `Global` of a server component in `next dev` is not edited by the tests.

The tests change `fixtures/shared/src/components.tsx` and `fixtures/shared/src/pages.tsx` for a moment. If a run is killed while one is edited, `git checkout` those two files. `next dev` also writes an `AGENTS.md` into `fixtures/next-app`; git ignores it.

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
- The development checker's question to `CSS.supports` is tested in Chromium only: what Firefox or WebKit would reject is not observed.
