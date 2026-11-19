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

Run in a browser, the engine writes into a `<style data-style="umber">` element it creates in the head, with `insertRule`. Run where there is no `document`, it keeps the rules in memory.

## Sheets

`engine.createSheet` is what `StyleSheet.create` is built on. It takes an object of styles or a function of the theme:

```ts
const sheet = engine.createSheet((view) => ({
  box: { padding: view.space[2] },
  accent: { color: view.palette.primary },
}))
const { box, accent } = sheet.resolve()
const merged = engine.css(box, accent, { opacity: 0.9 })
```

`box.className` is `umber-qdsl9p` and `accent.className` is `umber-n8ncc0`. `merged` is `umber-1ntlncu`: one class with all three. `sheet.resolve()` resolves against the base theme; `resolve(view)` takes the theme view that `engine.createThemeView(realTheme)` makes. `sheet.isDynamic` says whether the sheet is a function.

## Getting the CSS out

`createStyleTag(engine.cache)` is a `<style>` element as a string, with every rule inserted so far:

```ts
import { createStyleTag } from '@umber-style/core'

const tag = createStyleTag(engine.cache)
```

```html
<style
  data-style="umber"
  data-ids="umber-sarboa umber-layers umber-theme-jg3s2a umber-theme-l0twti umber-qdsl9p umber-n8ncc0 umber-1ntlncu --umber-palette-primary --umber-space-2"
>
  @layer umber-theme, umber-global, umber-components, umber-overrides;
  @layer umber-components {
    .umber-sarboa {
      color: var(--umber-palette-primary);
      padding: var(--umber-space-2);
    }
  }
  @layer umber-components {
    .umber-sarboa:hover {
      opacity: 0.8;
    }
  }
  @layer umber-theme {
    .umber-theme-jg3s2a {
      --umber-palette-primary: #1b5fd1;
      --umber-space-2: 8px;
      color-scheme: light;
    }
  }
  @layer umber-theme {
    .umber-theme-l0twti {
      --umber-palette-primary: #8ab4ff;
      color-scheme: dark;
    }
  }
  @layer umber-components {
    .umber-qdsl9p {
      padding: var(--umber-space-2);
    }
  }
  @layer umber-components {
    .umber-n8ncc0 {
      color: var(--umber-palette-primary);
    }
  }
  @layer umber-components {
    .umber-1ntlncu {
      padding: var(--umber-space-2);
      color: var(--umber-palette-primary);
      opacity: 0.9;
    }
  }
</style>
```

`cache.extract()` returns the same as `{ css, ids }`. `data-ids` is what a cache made later in a browser reads, so that it does not insert these rules again. See [Server rendering](server-rendering.md).

## A cache of your own

`createCache(options)` makes the cache an engine uses. Make one when you want to choose where the rules go, or to share it. The sheet is where rules are inserted: `createMemorySheet()` keeps them in an array, `createDomSheet(key, container?)` writes to the `<style data-style="key">` element, and any object with `insert(rule)` and `rules` is a sheet.

```ts
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'

const sheet = createMemorySheet()
const cache = createCache({ prefix: 'umber', sheet })
const engine = createEngine({ space: [0, 4] }, { cache })
engine.css({ padding: engine.refs.space[1] })
```

`sheet.rules` is then the layer statement and `@layer umber-components{.umber-d940h0{padding:var(--umber-space-1);}}`.

When you give an engine a cache, its `hasLayers`, `hasPruning`, `hasColorFallbacks`, `hasScope`, `suffix` and `hasLabels` come from the cache. Give both the same `prefix` (the engine uses its own `prefix` for variable names and the cache's for class names), or give only the cache and let the engine take its prefix.

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

| Member                                            | What it does                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `cache`                                           | The cache                                                                                                  |
| `hasTheme`, `baseTheme`                           | Whether there is a base theme, and what it is                                                              |
| `refs`                                            | The base theme as references. Throws before there is a theme                                               |
| `setTheme(theme)`                                 | Gives the engine its base theme                                                                            |
| `createThemeView(realTheme)`                      | The view of a real theme: references for tokens, real values for the rest. Made once for each theme object |
| `css(...values)`                                  | One class for style objects, sheet entries and class names the cache made                                  |
| `themeClass(theme, colorScheme?)`                 | The theme class string: theme class, boundary marker and scheme marker                                     |
| `themeId(theme, colorScheme?)`                    | The theme class alone, which rules and style elements are keyed by                                         |
| `when(theme, colorScheme?)`, `whenScheme(scheme)` | Keys for [theme conditions](theme-conditions.md)                                                           |
| `scopeClass()`                                    | The class of the `display: contents` wrapper a provider renders, made once                                 |
| `createSheet(styles)`                             | A sheet, as above                                                                                          |
| `createStyler(options, styles, inherited?)`       | What every web `styled` shares: the label, the style list and the class memo                               |

## Everything `@umber-style/core` exports

| Export                                                                                                                                                                          | What it is                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `createEngine`, `createLazyEngine`, `NO_THEME_MESSAGE`                                                                                                                          | The engine, the engine without a theme, and the error text of "no theme yet" |
| `createCache`, `createMemorySheet`, `createDomSheet`                                                                                                                            | The cache and its two sheets                                                 |
| `RULE_LAYERS`                                                                                                                                                                   | `['theme', 'global', 'components', 'overrides']`                             |
| `createStyleTag`                                                                                                                                                                | The `<style>` element of a cache, as a string                                |
| `add`, `subtract`, `multiply`, `divide`, `negate`                                                                                                                               | Arithmetic on tokens                                                         |
| `alpha`, `isAlphaColor`                                                                                                                                                         | A colour at an opacity, and the test for its result                          |
| `createSheetEntry`, `isSheetEntry`, `flattenStyle`                                                                                                                              | Sheet entries and the flattening of a `style` prop into a list               |
| `mergeStyles`, `compileRules`, `readLabel`                                                                                                                                      | The serializer: merge style objects, compile one to rules, read its label    |
| `createThemeKey`, `createSchemeKey`, `readCondition`, `createThemeClassName`, `getBoundaryClass`, `getSchemeClass`, `createScopeRule`, `createNoSchemeGuard`, `DEFAULT_SCOPING` | The pieces of theme conditions                                               |
| `createThemeClass`, `toDeclarationText`                                                                                                                                         | Make a theme class from declarations                                         |
| `createTokens`                                                                                                                                                                  | Turn a theme into references and declarations                                |
| `mergeDeep`, `hashString`                                                                                                                                                       | Merge a partial theme over a theme, and the hash that class names use        |

Types include `Engine`, `EngineOptions`, `BindingOptions`, `Cache`, `CacheOptions`, `Sheet`, `SheetEntry`, `Styler`, `StylerOptions`, `Theme`, `ThemeKey`, `SchemeKey`, `SchemeName`, `ColorScheme`, `TokenMode`, `TokenOptions`, `Tokens`, `DeepPartial`, `RegisteredSyntax`, `AlphaColor`, `WebStyleObject`, `WebProperties`, `StyleObject`, `StyleInput`, `StyleFunction`, `StyleResult`, `SheetStyles` and `SheetInput`. Every option is in [Options reference](options.md).

## Limits

- `engine.css` returns a class name but does not put it anywhere: apply it to an element yourself.
- Classes are never removed from a cache.
- The core was run in Node and in jsdom. It was not run in a worker or in a real browser by the tests.
