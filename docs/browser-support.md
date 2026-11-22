# Browser and platform support

After this page you can tell which browser features the engine's output needs, what happens in a browser that lacks one, and which versions of the tools the packages were built against.

**Browser version numbers are not stated here.** The repository has no test that runs a browser, so no minimum version was checked. Each row names the feature that is required, and the version that first supports it is to be confirmed against a browser compatibility source before it is published.

## What the output needs

| Feature                                        | Used for                                                     | When it is written                               | In a browser without it                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| CSS custom properties                          | Every token                                                  | Always                                           | The engine does not work                                                                     |
| Cascade layers (`@layer`)                      | The four layers                                              | Unless `hasLayers: false`                        | Every rule is dropped. With `hasLayers: false` nothing is written in a layer                 |
| `display: contents`                            | The `<prefix>-scope` wrapper of a provider                   | Always, with a provider that renders a wrapper   | The wrapper takes part in layout                                                             |
| `color-mix()`                                  | `alpha()` with an opacity between 0 and 1                    | With `alpha()`, after the fallback               | The declaration is ignored; the fallback declaration before it applies (`hasColorFallbacks`) |
| `@property`                                    | Registered tokens                                            | Only for tokens you register                     | The rule is ignored: the token works and does not animate                                    |
| `@keyframes`, CSS animations                   | `keyframes`                                                  | Only when a style or a global rule names one     | The animation does not run                                                                   |
| `@scope`                                       | `when()` and `whenScheme()`                                  | Only when you use them, unless `hasScope: false` | Those rules are dropped, and the style falls back to the base style                          |
| `:where()`, `prefers-color-scheme` media query | The guard of `whenScheme` for the system preference          | Only with `whenScheme`                           | The rule is dropped                                                                          |
| Media query range syntax (`width >= 600px`)    | The output of `@soroush.tech/styled-system` responsive props | Only with that package                           | The media rule is dropped. This is that package's output, not the engine's                   |

A rule that a browser rejects is skipped when it is inserted (`createDomSheet` catches the error), and the rest of the sheet still loads. For a page rendered on the server, the rules are text in a `<style>` element, and the browser parses them, ignoring what it does not know.

## Floors

- **With the defaults**, the floor is a browser that supports custom properties, cascade layers and `display: contents`: the features that have no fallback. The one of them that arrived last decides the floor; which one that is, and its version, is to be confirmed.
- **With `hasLayers: false`**, the floor is a browser with custom properties and `display: contents`, and colours degrade to their fallbacks. That claim rests on the specifications and on the output of the engine. It was not run in an old browser.
- Without `color-mix()` the colour of an `alpha()` is its fallback: the literal at that opacity as `rgba()` if the engine can read it, otherwise the colour at full opacity.

## Platforms and tools

| Part              | What the packages declare or were tested with                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React             | Peer dependency `^19.2.8`. Tested with 19.3.1                                                                                                                          |
| Vue               | Peer dependency `^3.5.0`. Tested with 3.5.45                                                                                                                           |
| React Native      | Optional peer dependency `>=0.76.0`. Compiled against 0.88.1 types. Never run in an app                                                                                |
| TypeScript        | Tested with 7.0.2                                                                                                                                                      |
| Node              | The core and the bindings render on a server in Node. The repository's `.nvmrc` names Node 26 for development                                                          |
| Server components | React 19, using `React.cache` and `<style href precedence>`. Never run in a bundler                                                                                    |
| Module format     | Published as ESM (`.mjs`) and CommonJS (`.cjs`), each with its declarations (`.d.mts`, `.d.cts`). Inside the repository the packages are consumed as TypeScript source |

## Limits

- No browser was used. Everything in the first table is the engine's output plus knowledge of the CSS features, not an observed result.
- jsdom was used for DOM tests. It evaluates `@scope` and `@layer` and computes custom properties, but it is not a browser and runs no transitions.
