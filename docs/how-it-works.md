# How it works

After this page you can follow a style object to the CSS it becomes, say what a class name and a theme class are, and explain why a style does not depend on the theme.

## From a style object to rules

A style is a plain object. The engine turns it into CSS rules when a component first uses it:

- A key is a CSS property in camelCase. It is written in kebab-case (`backgroundColor` becomes `background-color`, `msTransform` becomes `-ms-transform`). A key that starts with `--` is a custom property and is written as it is.
- A number is a length in pixels (`padding: 8` becomes `padding:8px`), except `0`, custom properties, and properties that take no unit (`opacity`, `zIndex`, `lineHeight`, `flex`, `fontWeight` and the others in the serializer's list). A number for `animationDuration`, `animationDelay`, `transitionDuration` or `transitionDelay` is a time in milliseconds, `0` too (`transitionDuration: 150` becomes `transition-duration:150ms`).
- An array is a list of fallbacks: `display: ['block', 'grid']` writes `display:block;display:grid;`.
- `null`, `undefined` and `false` are skipped, so `isOpen && { ... }` works.
- A nested object is a nested rule. A key with `&` is a selector where `&` stands for the parent (`'&:hover'`, `'& > p'`). A key that starts with `:` and has no `&` is the element itself (`':hover'` is `'&:hover'`). Any other key without `&` is a descendant selector. A key that starts with `@` wraps the rules in an at-rule (`@media`, `@supports`). A key such as `when(theme)` is a theme condition: see [Theme conditions](theme-conditions.md).
- `label` is not a declaration. It becomes part of the class name.

```ts
const className = engine.css({
  padding: 8,
  '&:hover': { opacity: 0.8 },
  '@media (min-width: 40em)': { padding: 16 },
})
```

returns `umber-1p2a3xt` and writes three rules, each in a cascade layer (see [Cascade layers and overrides](cascade-layers.md)):

```text
@layer umber-components{.umber-1p2a3xt{padding:8px;}}
@layer umber-components{.umber-1p2a3xt:hover{opacity:0.8;}}
@layer umber-components{@media (min-width: 40em){.umber-1p2a3xt{padding:16px;}}}
```

There is no CSS processor and no build step. The serializer is a function that runs when the page runs. In the browser the rules go into `<style data-style="<prefix>">` elements: outside production each rule is the text of an element of its own, in the order the rules were written, so the element inspector and `textContent` show the live rules, and the browser parses each rule once; in production they go into one element with the browser's `insertRule`, which is faster and leaves the text empty. `speedy` decides it either way: see [`speedy`](options.md#speedy).

## The text of a rule

Every place where the engine gives the text of a rule writes it in one format: the text of the style elements, `sheet.rules`, `cache.extract()`, `createStyleTag`, `extractPageStyles`, the chunks and tags of `@umber-style/server`, `onInsert` and the `inserted` of `@umber-style/cache`, the declarations of `readThemeText` and the `styles` of a `css()` value. It is CSS with no space and no newline where CSS needs none:

- A rule is its prelude, then `{`, its declarations, `}`: `.umber-1p2a3xt{padding:8px;}`. Nothing stands between them.
- A declaration is `name:value;`. Every declaration ends with `;`, the last one too: `.x{border:none;}`. The name is in kebab-case; the value is written as it was given, with its own spaces (`0 1px 2px`, `calc(1px + 2px)`, `rgba(0, 0, 0, 0.5)`), and a number gets its unit (`8px`, `150ms`).
- A nested selector is a rule of its own, after the rule of the declarations: `.x:hover{opacity:0.8;}`. A selector list is joined by `,` with no space (`html,body`, `.x:hover,.x:focus`); a descendant is one space (`.x p`); the rest of a selector is written as the key gives it (`.x > p`).
- An at-rule that holds rules is its prelude, then `{`, the rules, `}`: `@media (min-width: 40em){.x{padding:16px;}}`. The prelude is written as the key gives it, spaces included. The engine's own preludes are `@layer <name>`, `@media (prefers-color-scheme: <scheme>)`, `@scope (<start>) to (<limits>)`, `@keyframes <name>` and `@property <name>`.
- In a cascade layer a rule is wrapped once more: `@layer umber-components{.x{color:red;}}`, `@layer umber-components{@media (min-width: 40em){.x{padding:16px;}}}`. The order statement is `@layer umber-theme,umber-global,umber-components,umber-overrides;`.
- A `@keyframes` rule holds its steps as rules, by percentage: `@keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}`.
- Rules follow each other with nothing between them, in a style element and in a CSS text of the server.

The examples in these pages are that text, one rule on a line. What a browser gives back for a rule (`sheet.cssRules[0].cssText`) is the browser's own writing of it (`.x { color: red; }` in Chromium and jsdom), not this text.

## Classes and the cache

A cache turns a style into a class name and inserts the rules once. The class name is `<prefix>-<label>-<hash>`:

- `prefix` is the cache's prefix (`css` by default).
- `label` is the style's `label`, which `styled` sets from `name` and `slot` (`umber-button-root-15gvy7r`). It is left out without a name, or with `hasLabels: false`. The labels of merged styles are joined in order (`umber-Typography-Link-3n5swy`): see [Writing styles](writing-styles.md#the-labels-of-merged-styles).
- `hash` is a hash of the compiled rules. The same style always gives the same class, in the same or another process, so a server and a browser agree on names.

Several styles merge into one class: later keys win, nested objects merge key by key. `cache.css(a, b)` is one class for both.

Classes that the cache made can be passed back in. They are resolved to their styles and merged, so `engine.css(sheetEntry, { opacity: 0.9 })` is one class, not two.

Two kinds of rule are not a class. A `@keyframes` rule is written once, the first time a class names its animation (`keyframes` returns the name, and the cache finds it in `animation` and `animation-name`). A global rule (`Global`, `engine.insertGlobal`) is written for a selector such as `body`, counted, and removed when nothing holds it any more. See [Animations and global styles](animations-and-global-styles.md).

## A base class and a props class

A component made by `styled` does not always write one class. Its styles are split by position into two parts:

- the **base** is the leading part of the styles that does not depend on props; it may use theme tokens. It is one class, made once;
- the **props part** starts at the first style that depends on props and takes everything after it. It is made again for each render, and gives one class for each distinct result.

```tsx
const Flex = styled('div', { name: 'Flex' })<{ gap?: number; direction?: 'row' | 'column' }>(
  { display: 'flex', minWidth: 0 },
  ({ gap, direction }) => ({ gap, flexDirection: direction })
)

const App = () => (
  <>
    <Flex gap={4} direction="row" />
    <Flex gap={8} direction="row" />
    <Flex gap={8} direction="column" />
  </>
)
```

The three elements share one base class, and each has a props class of its own:

```html
<div class="umber-flex-root-182dnr0 umber-flex-root-1o6pbk7"></div>
<div class="umber-flex-root-182dnr0 umber-flex-root-1gb9ruy"></div>
<div class="umber-flex-root-182dnr0 umber-flex-root-canzou"></div>
```

```text
@layer umber-components{.umber-flex-root-182dnr0{display:flex;min-width:0;}}
@layer umber-components{.umber-flex-root-1o6pbk7{gap:4px;flex-direction:row;}}
@layer umber-components{.umber-flex-root-1gb9ruy{gap:8px;flex-direction:row;}}
@layer umber-components{.umber-flex-root-canzou{gap:8px;flex-direction:column;}}
```

Without the split (`hasBaseClass: false`) each of the three would be one class with `display: flex; min-width: 0` repeated in it. With many props the saving grows: a layout component with three fixed declarations and six props, rendered with 48 distinct combinations, writes 291 declarations and 7216 bytes of CSS with the split, and 432 declarations and 9388 bytes without it (one more rule, the base; `packages/core/src/measureBase.test.ts` makes this measurement).

A style is **props-independent** when it is a plain object, or a function that reads nothing from its argument except `theme`. The engine finds out by calling such a function once with its props wrapped so that every read of a prop is noted (so is spreading or listing the props). A function that reads no prop took a path that only depends on the theme, so its result is the same for every later call with that theme and is kept. The base is worked out once for each theme object (the view that the nearest provider gives), not once for each component: two providers that differ only in token values give one base class and one rule, because a token is the same `var(--name)` reference under both.

Order matters, so the split is by position and not by kind. A plain object that comes after the first props-dependent style is in the props part, even though it does not depend on props, so that it still wins over what came before it.

The element carries `base props [foreign] [override]`: the base class, the props class, class names that are not the engine's, and, only when something is given from outside, the override class (see [Cascade layers and overrides](cascade-layers.md)). A component with no props-dependent style has the base class only, with the name it always had. A component whose first style depends on props has no base class.

The base and the props class are in the same layer, and the base is always written first, so a rule of the props class wins a tie. [Cascade layers and overrides](cascade-layers.md) says exactly which rules this decides, and where it differs from one merged class.

## Tokens are variables

A theme is a plain object. The engine reads it once and gives back the same shape with a `var(--name)` reference in place of each value:

```ts
const theme = { palette: { primary: '#1b5fd1' }, space: [0, 4, 8, 16] }
const engine = createEngine(theme, { prefix: 'umber' })

engine.refs.palette.primary // 'var(--umber-palette-primary)'
engine.refs.space[2] //        'var(--umber-space-2)'
```

A variable name is `--<prefix>-<path>`, with each path segment in kebab-case. A function style gets these references, so what it writes into the CSS is a reference, never the value.

The value goes somewhere else: a theme class. `engine.themeClass(theme)` makes a class that declares the variables with the theme's values:

```text
.umber-theme-jg3s2a{--umber-palette-primary:#1b5fd1;--umber-space-2:8px;color-scheme:light;}
```

Any element below an element with that class sees the values. The variables a class declares are only the ones some rule uses: see [Tokens](tokens.md).

A number under `space`, `sizes`, `radii`, `fontSizes` or `borderWidths` is a length and is declared with `px` (`--umber-space-2:8px`). Other numbers are declared as they are. `breakpoints` and `components` are kept as real values and get no variable: see the token modes in [Tokens](tokens.md).

## One class for every theme

Because a rule holds `var(--umber-palette-primary)` and not `#1b5fd1`, the rule is the same under every theme. Two themes that differ only in token values give the same class:

```tsx
import { createStyle } from '@umber-style/react'

const light = { palette: { primary: '#1b5fd1' } }
const warm = { palette: { primary: '#c2410c' } }

const { styled, ThemeProvider } = createStyle(light, { prefix: 'umber' })

const Tag = styled('span', { name: 'Tag' })(({ theme }) => ({
  color: theme.palette.primary,
}))

const App = () => (
  <ThemeProvider theme={light}>
    <Tag>one</Tag>
    <ThemeProvider theme={warm}>
      <Tag>two</Tag>
    </ThemeProvider>
  </ThemeProvider>
)
```

Both tags get `umber-tag-root-n8ncc0`. The sheet holds one component rule and one theme rule for each theme: the outermost provider declares its theme on `:root`, the nested one in the theme class on its wrapper:

```text
.umber-tag-root-n8ncc0{color:var(--umber-palette-primary);}
:where(:root){--umber-palette-primary:#1b5fd1;}
.umber-theme-1an5zox{--umber-palette-primary:#c2410c;}
```

This is the idea behind the engine:

- A style is computed once, however many themes you have.
- Switching a theme is changing a class, or rewriting the `:root` rule, so no styled component renders again and no style is recomputed.
- A theme can be added at run time by making one more theme class: see [The root theme and switching](root-theme.md).

What does depend on the theme is whatever is not a token: a breakpoint, a number you compute with, a function. Those are real values, read from the nearest provider, and a different value makes a different class: see [Themes](themes.md).

## Platforms

The web bindings (`@umber-style/react`, `@umber-style/vue`) use this model. React Native has no CSS and no variables, so `@umber-style/react-native` skips it: a style function receives the real values and returns an object for the platform's own `StyleSheet`. The names (`styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply`) are the same, so one source can run on both: see [Style sheets and the style prop](style-sheets.md).

## Two copies in one program

A program can load the core twice: a package bundled into a server build next to one that is left external, or two versions installed in one tree. What one copy registers, another must find: a name that `keyframes()` of one copy returned is written by the cache of the other, and a class that a styled component of one copy makes must have the same labels in a program with one copy (the browser) as in a program with two (the server), or the first HTML and the browser would not agree.

So the state that copies must share lives in one registry on `globalThis`, under `Symbol.for('umber-style.registry')`, which every copy reaches alike. The registry is a `Map` whose own shape never changes. Each entry is keyed `<package>.<name>@<shape>` (`core.keyframes@1`): a release that changes what an entry holds gives it a new shape number, so an older copy keeps reading the entry it knows and the two simply stop sharing that one entry; nothing an older copy reads changes under it.

| Entry                                                      | What it holds                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `core.keyframes@1`                                         | The steps of every name `keyframes()` returned                                               |
| `core.caches@1`                                            | The cache of each prefix in each document, which `findCache` gives                           |
| `core.element-modes@1`, `core.written-text@1`              | How each style element is written (text or `insertRule`), and which text nodes a cache wrote |
| `core.label-styles@1`                                      | The label marks that a wrapper finds among the styles of the component it wraps              |
| `react.default-style@1`, `react.server-default-style@1`    | The default style of each build of the React binding                                         |
| `react.cache-provider@1`, `react.marks@1`                  | The context of `CacheProvider`, and the marks of the nearest provider                        |
| `react.prefix-styles@1`                                    | The theme contexts of each prefix                                                            |
| `vue.default-style@1`, `vue.cache-provider@1`              | The default style of the Vue binding, and the key of its `CacheProvider`                     |
| `react-native.default-style@1`, `react-native.theme-ids@1` | The default style of the React Native binding, and the ids that `when(theme)` names          |
| `css.default-instance@1`                                   | The default instance of `@umber-style/css`                                                   |

The rest stays in each copy: what is only remembered to go faster (the CSS names of properties, the parsed templates, the parsed media queries, the plain data of a theme), the warnings already given, and the subscriptions of React Native to the platform, which each copy makes for itself and which give each the same answers.

Every entry was module state before: it lived as long as the process, and was seen by every request a server rendered. On `globalThis` it lives as long and is seen by the same requests, so a server keeps requests apart exactly as before. None of it holds the styles of a request: the names and labels are made from the code of the components, the caches of a page are keyed by a document (a server has none), the contexts hold no value outside a render, and a request that uses its own cache (`createCache`, a `CacheProvider`) keeps it out of the registry.

In development (`process.env.NODE_ENV` is `development`) a second copy warns once when it first reads the registry. Two versions:

```text
[umber-style] @umber-style/core 0.2.0 is loaded next to @umber-style/core 0.2.1. The copies share the state that both versions store alike, and keep the rest apart. It usually happens when a package is bundled into a build next to one that is left external, or when two versions are installed in one tree: install one version, and bundle the packages of UmberStyle together or not at all.
```

Two copies of one version say `Two copies of @umber-style/core 0.2.0 are loaded. They share their state, but the code is loaded twice.` with the same advice, and only where there is a document (a browser, or a test environment that has one). A server of server components loads the core once for the server components and once for the render of the client components, by design (the development server of the Next.js App Router does), and those two copies share everything: that is not warned about.

## Limits

- A copy of version 0.1.0 has no registry: it shares nothing with a later copy, and a later copy does not see it to warn.
- The copies are tested as two module instances in one test (`copies.test.ts` of the core, the bindings and `@umber-style/css`), not as two builds of an app.
- The explanation of one class for every theme holds for the `variable` and `reference` token modes. In `inline` mode the real value is written into the rule, so a theme that changes it makes another class. See [Tokens](tokens.md).
- Classes and `@keyframes` rules are never removed from the cache or from the style sheet while the page lives; only global rules are. A style that is built from many different values (a measured number, for example) adds one class and its rules for each value. See [No inline styles](no-inline-styles.md).
- The base of a component is only as good as the test that a function reads no prop. A prop that is read inside a function that the style returns, or later (a callback), is not seen; a style that reads module state that changes is not pure, and the base would keep its first result for a theme. Style functions are expected to be pure functions of their props and the theme.
- The first call of a style function for a theme object runs with the wrapped props; later calls for that theme use the plain props. A theme object that is made again on every render (an inline `theme={{ ... }}` on a provider) is a new theme object each time, so each render works the base out again.
- The text format takes no space out of what you write: the prelude of an at-rule, the parts of a selector and a value keep the spaces they were given. Only the commas of a selector list are rewritten.
- In the text of a style element the browser drops a rule it rejects when it parses the text, and the text keeps it; `insertRule` throws for it, and the sheet skips it. The text of an element that a server sent is not rewritten: a rule of it that the cache removes (a global rule released, the root rule of the server) leaves the cascade, and stays in that element's text.
- The serializer's list of properties that take no unit is fixed in the code. A unitless number for a property that is not in the list gets `px`; write it as a string.
