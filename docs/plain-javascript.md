# Plain JavaScript

After this page you can use the engine on its own: make classes from style objects, make theme classes, extract the CSS, and know every export of `@umber-style/core`.

`@umber-style/core` is the engine. It knows no framework and touches no browser API at module level, so it runs in Node, in a worker and in a browser. Each binding is a thin layer over it.

## An engine, classes and theme classes

```ts
import { createEngine } from '@umber-style/core'

const theme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
}
const dark = { palette: { primary: '#8ab4ff', text: '#f2f2f2' } }

const engine = createEngine(theme, { prefix: 'umber' })
const { refs } = engine

const button = engine.css({
  color: refs.palette.primary,
  padding: refs.space[2],
  '&:hover': { opacity: 0.8 },
})
const light = engine.themeClass(theme, 'light')
const night = engine.themeClass(dark, 'dark')
```

- `engine.refs` is the theme as `var(--name)` references. Use it for the values of your styles.
- `engine.css(...styles)` merges the styles into one class and inserts its rules once. It returns the class name: `button` is `umber-sarboa`.
- `engine.themeClass(theme, colorScheme?)` makes the class that declares a theme's variables and returns the class string. `light` is `umber-theme-jg3s2a umber-boundary umber-scheme-light` and `night` is `umber-theme-l0twti umber-boundary umber-scheme-dark`. Put one on `document.documentElement`, or on any element, to give everything below it the theme.

Run in a browser, the engine writes into `<style data-style="umber">` elements it creates in the head: outside production each rule as the text of an element of its own, in production with `insertRule` into one element (`speedy`, see [Options reference](options.md#speedy)). Run where there is no `document`, it keeps the rules in memory.

## Sheets

`engine.createSheet` is what `StyleSheet.create` is built on. It takes a function of the theme or an object of styles, and they give different things.

A function gives a sheet, which `resolve` turns into entries:

```ts
const sheet = engine.createSheet((view) => ({
  box: { padding: view.space[2] },
  accent: { color: view.palette.primary },
}))
const { box, accent } = sheet.resolve()
const merged = engine.css(box, accent, { opacity: 0.9 })
```

`merged` is `umber-1ntlncu`: one class with all three. `sheet.resolve()` resolves against the base theme; `resolve(view)` takes the theme view that `engine.createThemeView(realTheme)` makes. `isThemedSheet(value)` says whether a value is such a sheet.

An object gives the entries themselves, at once, with no `resolve` and no theme:

```ts
const plain = engine.createSheet({ title: { fontSize: 18 }, note: { opacity: 0.5 } })
const title = plain.title.className // 'umber-1uho00b'
```

An object sheet works with an engine that has no theme yet (`createLazyEngine`, before `setTheme`), because it reads none: its styles cannot use tokens (there are no references to write), only plain values and `var(--name)` strings. The entries are made when a key is first read, so `createSheet` itself computes and writes nothing. `Object.keys` and a spread list the keys; a spread reads every one, which makes the entries and still writes no rule.

An entry writes its rule when it is first used, not when it is made. Using it is reading its `className`, passing it to `css`, or giving it to a styled component's `style`. `box` and `accent` above were only merged, so their own classes (`umber-qdsl9p`, `umber-n8ncc0`, which `className` would write) are not in the sheet. An entry has two classes, one for each way it is used: on its own it is in the `components` layer, and given alone to a styled component it is in the `overrides` layer; each is written only when used that way. See [Style sheets and the style prop](style-sheets.md).

## Getting the CSS out

`createStyleTag(engine.cache)` is a `<style>` element as a string, with every rule inserted so far, whatever page inserted it. A process that renders more than one page uses `extractPageStyles` instead (see [Server rendering](server-rendering.md)):

```ts
import { createStyleTag } from '@umber-style/core'

const tag = createStyleTag(engine.cache)
```

```text
<style data-style="umber" data-options="p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=">@layer umber-theme,umber-global,umber-components,umber-overrides;@layer umber-components{.umber-sarboa{color:var(--umber-palette-primary);padding:var(--umber-space-2);}}@layer umber-components{.umber-sarboa:hover{opacity:0.8;}}@layer umber-theme{.umber-theme-jg3s2a{--umber-palette-primary:#1b5fd1;--umber-space-2:8px;color-scheme:light;}}@layer umber-theme{.umber-theme-l0twti{--umber-palette-primary:#8ab4ff;color-scheme:dark;}}@layer umber-components{.umber-1ntlncu{padding:var(--umber-space-2);color:var(--umber-palette-primary);opacity:0.9;}}</style>
```

`cache.extract()` returns the same as `{ css, ids }`. `data-options` is the stamp of the options of the cache: a cache made later in a browser compares it with its own and throws one error that names the options that differ. The browser finds out which rules are already there by reading them, not from a list. See [Server rendering](server-rendering.md).

## A cache of your own

`createCache(options)` makes the cache an engine uses. Make one when you want to choose where the rules go, or to share it. The sheet is where rules are inserted: `createMemorySheet()` keeps them in an array, `createDomSheet(key, container?)` writes to the `<style data-style="key">` element, and any object with `insert(rule)` and `rules` is a sheet.

`createDomSheet(key, container)` looks up and creates its style elements in the document of `container` (`document.head` by default), and its `document` member is that document. A cache made over it serves that document: it reads the style elements a server left there and those that arrive later as children of its `<head>` or `<body>`, compares the stamp of the options there, and in development checks that page. So a cache for an iframe is `createCache({ prefix: 'frame', sheet: createDomSheet('frame', iframe.contentDocument.head) })` (`cache.document.test.ts`). A sheet with no `document` (one in memory) leaves the cache with the global `document`, where there is one.

```ts
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'

const sheet = createMemorySheet()
const cache = createCache({ prefix: 'umber', sheet })
const engine = createEngine({ space: [0, 4] }, { cache })
engine.css({ padding: engine.refs.space[1] })
```

`sheet.rules` is then the layer statement and `@layer umber-components{.umber-d940h0{padding:var(--umber-space-1);}}`.

When you give an engine a cache, its `hasLayers`, `hasBaseClass`, `hasPruning`, `hasColorFallbacks`, `hasScope`, `suffix` and `hasLabels` come from the cache. The engine takes the `prefix` of the cache for its variable names too, so give only the cache. Giving the engine a `prefix` as well is allowed only if it is the same one: a different one throws a `TypeError` that names both prefixes.

## The engine of another cache

`engine.withCache(cache)` is the engine of the same theme over another cache: the engine itself for its own cache, else one made on the first call and kept while the cache lives. It keeps the token options of the engine; its prefix is the cache's, for classes and variables alike. The two share one base theme: `setTheme` of either is the base of both. From `createEngine.withCache.test.ts`:

```ts
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'

const theme = { palette: { primary: '#0000ff', accent: '#ff0000' }, space: [0, 4, 8] }
const engine = createEngine(theme, {
  cache: createCache({ prefix: 'css', sheet: createMemorySheet() }),
})
const frame = createCache({ prefix: 'frame', sheet: createMemorySheet() })
const derived = engine.withCache(frame)
const name = derived.css({ color: derived.refs.palette.primary })
derived.declareRoot(theme)
```

`name` starts with `frame-`, its rule is `color:var(--frame-palette-primary)`, the root rule declares `--frame-palette-primary:#0000ff`, and the first cache has no rule. This is what a `CacheProvider` of a binding uses.

A sheet entry belongs to the cache that made it. Given to another cache (`cssIn('overrides', entry)`, `css(entry, ...)`), its style is written there, under a class of that cache: `cache.adoptEntry(entry)` is that cache's entry for it, made once. `engine.adoptSheet(entries)` does it for each entry of a sheet, and `findEntryCache(values)` is the cache that made the first entry among `values`.

## An engine with no theme yet

`createLazyEngine` makes an engine that takes its theme later, from `setTheme(theme)` or from the first `themeClass(theme)` call. The bindings use it for their default style:

```ts
import { createLazyEngine } from '@umber-style/core'

const theme = { palette: { primary: '#1b5fd1' } }

const engine = createLazyEngine<typeof theme>({ prefix: 'umber' })
const before = engine.hasTheme // false
engine.setTheme(theme)
const class1 = engine.css({ color: engine.refs.palette.primary }) // 'umber-n8ncc0'
```

`createLazyEngine` without a type argument types the theme as the `Theme` interface, which you declare once: see [Themes](themes.md). `setTheme` with the same object does nothing; with another object it replaces the base theme. Reading `refs` before there is a theme throws.

## What an engine has

| Member                                            | What it does                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `cache`                                           | The cache                                                                                                                          |
| `hasTheme`, `baseTheme`                           | Whether there is a base theme, and what it is: given, or adopted from the first `themeClass` or provider                           |
| `givenTheme`                                      | The base theme given on purpose (`createEngine(theme)`, `setTheme`), or undefined: what a binding reads where no provider is above |
| `refs`                                            | The base theme as references. Throws before there is a theme                                                                       |
| `setTheme(theme)`                                 | Gives the engine its base theme, on purpose                                                                                        |
| `adoptTheme(theme)`                               | Gives the engine a base theme for its shape when it has none, not as a given one: what the first provider does                     |
| `createThemeView(realTheme)`                      | The view of a real theme: references for tokens, real values for the rest. Made once for each theme object                         |
| `css(...values)`                                  | One class for style objects, sheet entries and class names the cache made                                                          |
| `themeClass(theme, colorScheme?)`                 | The theme class string: theme class, boundary marker and scheme marker                                                             |
| `themeId(theme, colorScheme?)`                    | The theme class alone, which rules and style elements are keyed by                                                                 |
| `findThemeIds(theme)`                             | The theme classes already made for a theme object, without making any                                                              |
| `when(theme, colorScheme?)`, `whenScheme(scheme)` | Keys for [theme conditions](theme-conditions.md)                                                                                   |
| `scopeClass()`                                    | The class of the `display: contents` wrapper a provider renders, made once                                                         |
| `createSheet(styles)`                             | The entries of an object of styles, or a sheet for a function of the theme, as above                                               |
| `createStyler(options, styles, inherited?)`       | What every web `styled` shares: the label, the style list, the base and props classes and the class memo                           |
| `keyframes(steps, options?)`                      | Registers an animation and returns its name; the same as `keyframes` of the core, typed by the theme                               |
| `insertKeyframes(name)`                           | Writes the `@keyframes` rule of a name now, for a use the engine cannot see in a class                                             |
| `insertGlobal(styles, theme?)`                    | Writes global styles into the `global` layer and returns the function that releases them                                           |
| `resolveGlobal(styles, theme?)`                   | The sets of rules of global styles, `{ id, rules, animations }`, without writing them                                              |

## Everything `@umber-style/core` exports

Every value the entry exports is in this table, once (`index.test.ts` of the core compares the table with the entry).

| Export                                                                                                                                                                          | What it is                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createEngine`, `createLazyEngine`, `NO_THEME_MESSAGE`, `EMPTY_THEME`                                                                                                           | The engine, the engine without a theme, the error text of "no theme yet", and the empty theme where there is no provider and no base theme                                                                                   |
| `createCache`, `createMemorySheet`, `createDomSheet`, `RULE_LAYERS`, `createStyleSelector`, `findCache`                                                                         | The cache and its two sheets, `['theme', 'global', 'components', 'overrides']`, the selector of the style elements of a prefix, and the cache that writes into a document for a prefix                                       |
| `createStyleTag`, `extractPageStyles`, `extractPageStyleParts`, `createNonceAttribute`, `createGlobalMarker`                                                                    | The `<style>` element of a cache, the CSS of one page (in one piece or in two parts), the escaped `nonce` attribute of a tag, and the marker by which a `Global` names its sets in a server render                           |
| `findMissingStyles`, `findMissingPaths`, `isDevelopment`                                                                                                                        | The development checks: the classes and variables of a page that have no rule or no value, the paths of token options that a theme does not have, and whether the build is a development one                                 |
| `add`, `subtract`, `multiply`, `divide`, `negate`                                                                                                                               | Arithmetic on tokens, and on the values of `useStyleValue`                                                                                                                                                                   |
| `alpha`, `isAlphaColor`, `toRgba`, `assertAlphaInput`                                                                                                                           | A colour at an opacity, the test for its result, the rgba() parser that the React Native `alpha` shares, and the check of the arguments                                                                                      |
| `at`                                                                                                                                                                            | `{ [key]: style }` typed to spread into a web style: see [Typed styles](typed-styles.md)                                                                                                                                     |
| `createLiveValue`, `declareLiveValue`, `isLiveValue`, `writeLiveValue`                                                                                                          | The values of `useStyleValue`: a value of a variable, the rule that declares it in a document, the test for a value, and a new number for it (see [Writing styles](writing-styles.md#a-value-that-changes-without-a-render)) |
| `createSheetEntry`, `isSheetEntry`, `readEntrySource`, `findEntryCache`, `flattenStyle`, `isThemedSheet`, `createLazyRecord`, `createDeferredRecord`, `createDeferredObject`    | Sheet entries and the cache that made one, the flattening of a `style` prop into a list, the test for a sheet made from a function, and objects whose values, or which themselves, are made on first use                     |
| `createCssEntry`, `createComponentSelector`, `readStaticTemplate`, `readStyleArguments`, `rejectFunctions`                                                                      | What `css()` and `styled` of a web binding share: the entry of `css()`, a styled component as a selector, a template with no props, the styles of a call, and the check that no function was given where there are no props  |
| `isTemplateStrings`, `parseStyleTemplate`, `parseKeyframesTemplate`, `withTagShorthands`                                                                                        | The readers of a tagged template, and `styled.div` and the other tags on a `styled`                                                                                                                                          |
| `mergeStyles`, `compileRules`, `readLabel`                                                                                                                                      | The serializer: merge style objects, compile one to rules, read its label                                                                                                                                                    |
| `createThemeKey`, `createSchemeKey`, `readCondition`, `createThemeClassName`, `getBoundaryClass`, `getSchemeClass`, `createScopeRule`, `createNoSchemeGuard`, `DEFAULT_SCOPING` | The pieces of theme conditions                                                                                                                                                                                               |
| `state`, `readState`, `STATE_SELECTORS`                                                                                                                                         | The [state keys](writing-styles.md#interaction-states): the key of a state, the state a key names, and the selector each state is written as on the web                                                                      |
| `createThemeClass`, `createThemeId`, `createThemeRule`, `ROOT_SELECTOR`, `toDeclarationText`                                                                                    | Make a theme class from declarations, name it without a cache, write its rule, the selector of the root theme (`:where(:root)`), and the text of declarations                                                                |
| `createTokens`, `mergeTheme`, `resolveThemeInput`, `mergeDeep`, `hashString`                                                                                                    | Turn a theme into references and declarations, the theme below a provider and the theme it adds, merge a partial theme over a theme, and the hash that class names use                                                       |
| `keyframes`, `globalStyles`                                                                                                                                                     | An animation's name, and a handle of global styles: see [Animations and global styles](animations-and-global-styles.md)                                                                                                      |
| `readSharedState`                                                                                                                                                               | The state that every copy of the packages in one program shares under a key (see [How it works](how-it-works.md#two-copies-in-one-program))                                                                                  |

Types include `Engine`, `EngineOptions`, `BindingOptions`, `Cache`, `CacheOptions`, `Sheet`, `SheetEntry`, `Styler`, `StylerOptions`, `Theme`, `ThemeKey`, `SchemeKey`, `SchemeName`, `ColorScheme`, `TokenMode`, `TokenOptions`, `Tokens`, `DeepPartial`, `RegisteredSyntax`, `AlphaColor`, `WebStyleObject`, `WebProperties`, `WebNested`, `NestedKey`, `StyleObject`, `StyleInput`, `StyleFunction`, `StyleResult`, `SheetStyles`, `SheetInput`, `SheetEntries`, `ThemedSheet`, `ObjectSheet`, `ClassOptions`, `KeyframesInput`, `KeyframesOptions`, `KeyframesStep`, `KeyframesSteps`, `GlobalStyles`, `GlobalStylesInput`, `GlobalInput`, `GlobalStyleObject`, `GlobalStyleValue`, `AtRuleDescriptors`, `GlobalRules`, `LiveValue`, `LiveRule`, `StyleTagOptions` and `PageStyleOptions`. Every option is in [Options reference](options.md).

## Limits

- `engine.css` returns a class name but does not put it anywhere: apply it to an element yourself.
- Classes are never removed from a cache. Global rules are, when the function that `insertGlobal` returned is called and nothing else holds them.
- The core was run in Node and in jsdom. It was not run in a worker or in a real browser by the tests, apart from the browser tests of the core and the iframe test of the React binding.
- A cache watches the children of the `<head>` and the `<body>` of its document; a style element added deeper is not read.
