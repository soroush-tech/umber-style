# Class names without a theme

After this page you can make class names from styles with `@umber-style/css`, merge them, write keyframes and global rules, render them on a server and hydrate them, and make an instance of your own or share a cache with other code.

`@umber-style/css` is the plain layer under the engine: a style goes to a cache and comes back as a class name, a string. It has no theme: no tokens, no CSS variables, no theme class and no provider. It knows no framework. It is built on the cache and the serializer of `@umber-style/core`, and on nothing else of it.

```ts
import { css, cx, keyframes, injectGlobal } from '@umber-style/css'

const card = css({ padding: 8, '&:hover': { opacity: 0.9 } }) // a class name, a string
const title = cx(card, isActive && active) // merged, the last winning
```

## When to use it, and when `styled`

Use `@umber-style/css` when code only wants a class name: an element that a script makes, a widget that takes a `className` string, a string put into a template. Nothing has to be rendered around it.

Use `styled` (see [React](react.md), [Vue](vue.md)) when a style needs the theme: token references, a theme that changes with a class on an element, a style written as a function of the theme or of props, the `style` prop, or the style elements that a framework renders on a server. None of that is in this package.

## `css`

`css` takes style objects, class names and nothing, and returns one class name for them:

```ts
const card = css({ padding: 8, '&:hover': { opacity: 0.9 } })
// card is 'css-18abfvh'
// sheet.rules is ['.css-18abfvh{padding:8px;}', '.css-18abfvh:hover{opacity:0.9;}']
```

A style is written as in the rest of UmberStyle (see [Writing styles](writing-styles.md)): camelCase properties, numbers in pixels where CSS needs a unit, nested selectors with `&`, at-rules as keys. Equal styles give the same class, and its rules are written once.

What it takes:

| Argument                                   | What happens                                              |
| ------------------------------------------ | --------------------------------------------------------- |
| A style object                             | Merged with the others, left to right, so the last wins   |
| A class name this cache made               | Resolved back to its style, and merged at its place       |
| Any other string with `:` or `{`           | CSS text, read as a template is, and merged at its place  |
| Any other string                           | Passed through as a class name, in front of the new class |
| A list, nested lists                       | Flattened                                                 |
| `false`, `null`, `undefined`, `''`, `true` | Nothing                                                   |
| A tagged template                          | Read as CSS text (below), the one style of the call       |

```ts
const name = css({ color: 'red' })
css('app-card', { color: 'red' }, 'is-open') // `app-card is-open ${name}`
css('app-card') // 'app-card'

const base = css({ color: 'red', margin: 0 })
css(base, { color: 'blue' }) // the class of { margin: 0, color: 'blue' }
```

A class name holds neither `:` nor `{`, so a string that holds one of them, and is not a class this cache made, is CSS text: it is read as a tagged template with no interpolation is (below), and merged in order with the other arguments:

```ts
css('color: red; &:hover { opacity: 0.5; }') // the class of { color: 'red', '&:hover': { opacity: '0.5' } }

const base = css({ margin: 0, color: 'black' })
css(base, 'color: red; padding: 4px;', { padding: 8 }, 'app-card')
// `app-card ${the class of { margin: 0, color: 'red', padding: 8 }}`
```

Text that cannot be read throws the `TypeError` of the parser, with the line and the text around the place:

```text
parseStyleTemplate(): a "}" without a "{" at line 1: "color: red; }"
```

With nothing to write (no argument, only falsy values, an empty object) `css` returns the class names it was given, or `''`.

### As a tag

`css` is also a tag. The template is CSS text: declarations, nested rules, at-rules and comments.

```ts
const color = 'red'
css`
  color: ${color};
  &:hover {
    opacity: 0.5;
  }
`
// the class of { color: 'red', '&:hover': { opacity: '0.5' } }
```

An interpolation in a value, a selector or a property name is text. One alone between declarations is merged in: a style object, a class name this cache made, CSS text, or a list of them.

```ts
const base = css({ margin: 0 })
const extra = { padding: 4 }
css`
  ${base};
  ${extra};
  color: blue;
`
// the class of { margin: 0, padding: 4, color: 'blue' }
```

A function in a template is called with props in `styled`. `css` has no props and no theme, so a function in its template throws a `TypeError` at once, rather than being called with nothing:

```text
css(): an interpolation of this template is a function, which needs props or a theme, and css() has none. Call it yourself and interpolate what it returns.
```

## `cx`

`cx` takes class names, falsy values, lists and objects whose keys are class names that are kept when their value is truthy. When two or more of the classes were made by this cache, they are merged into one new class, the last winning, and the other class names pass through in front of it:

```ts
const card = css({ padding: 8, color: 'black' })
const active = css({ color: 'red' })
cx(card, active) // the class of { padding: 8, color: 'red' }
cx('app', card, 'open', active) // `app open ${the class of { padding: 8, color: 'red' }}`
cx([card, [null, { [active]: true, hidden: false }]], undefined, false, '') // as cx(card, active)
cx({ app: 1, other: 0 }, ['open']) // 'app open'
```

With fewer than two classes of this cache the string is kept as it is: `cx('app', card)` is `` `app ${card}` ``.

## `keyframes`

`keyframes` takes the steps of an animation, as an object or as a tagged template, and returns its name. It writes the `@keyframes` rule at once:

```ts
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
// fade is 'keyframes-<hash>'
// sheet.rules is [`@keyframes ${fade}{0%{opacity:0;}100%{opacity:1;}}`]

const to = 1
keyframes`
  from { opacity: 0; }
  to { opacity: ${to}; }
` // the same name
```

The name is a hash of the steps, so equal steps give the same name everywhere, and the rule is written once for each cache. The core's own `keyframes` only registers a name and writes the rule when a class uses it; this one writes it as well, because the name is a string that can go anywhere: into a style sheet of the app, into a class of another cache, or into a style that a script sets, where no class of this cache would bring the rule. A class of any cache of UmberStyle that uses the name still gets the rule written in its own cache, before the class:

```ts
const spin = keyframes({ to: { transform: 'rotate(360deg)' } }) // in one instance
const name = css({ animation: `${spin} 1s linear infinite` }) // in another
// the other's sheet.rules is
// [`@keyframes ${spin}{100%{transform:rotate(360deg);}}`, `.${name}{animation:${spin} 1s linear infinite;}`]
```

A function in a template throws a `TypeError`, as in `css`: there is no theme to call it with.

## `injectGlobal`

`injectGlobal` writes global rules at once: selectors (`body`, `html, body`, `*::before`) and at-rules (`@media (...)` holding selectors, `@font-face`) as keys, a selector's style written as a class's is. They stay; rules of the same text are written once. It takes several objects, lists and falsy values, in order, or a tagged template:

```ts
injectGlobal({ body: { margin: 0 }, '@media (min-width: 40em)': { html: { fontSize: 18 } } })
// sheet.rules is ['body{margin:0;}', '@media (min-width: 40em){html{font-size:18px;}}']

const margin = 0
injectGlobal`
  body { margin: ${margin}; }
`
```

The `@keyframes` rules of the animation names the rules use are written before them.

## `getRegisteredStyles` and `merge`

These two read the class names of a string the way `cx` does:

- `getRegisteredStyles(registeredStyles, classNames)` pushes the style object of each class of `classNames` that this cache made onto the array `registeredStyles`, in order, and returns the other class names, each followed by a space. The styles are objects, which `css` takes back.
- `merge(className)` merges the classes of `className` that this cache made into one new class, the last winning, after the other class names, when there are two or more of them; with fewer it returns `className` as it is. `cx` is `merge` of the joined class names.

```ts
const first = css({ color: 'red' })
const second = css({ margin: 0 })
const styles: StyleObject[] = []
getRegisteredStyles(styles, ` app  ${first} open ${second}`) // 'app open '
// styles is [{ color: 'red' }, { margin: 0 }]

merge(`${first} app ${second}`) // `app ${the class of { color: 'red', margin: 0 }}`
merge(`app ${first}`) // `app ${first}`
```

## Cascade layers: off

The engine writes every rule into a cascade layer (see [Cascade layers and overrides](cascade-layers.md)). This package does not, by default: its classes, keyframes and global rules are unlayered. A rule in a layer loses to every unlayered rule, whatever its specificity, and the CSS of an app that uses a plain class name is usually not layered. Unlayered, a class from `css()` is an ordinary class next to the app's own CSS: specificity and source order decide, as for any class. An instance can turn the layers on with `hasLayers: true` (below); a shared cache keeps its own setting.

## The server and hydration

Where there is no `document`, the rules are kept in memory and the cache extracts them, with the ids they cover:

```ts
injectGlobal({ body: { margin: 0 } })
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
const card = css({ padding: 8, animation: `${fade} 1s` })
const { css: text, ids } = cache.extract()
// text is the rules of the sheet, joined; ids holds card, `@keyframes:${fade}` and the id of the global rules
```

`createStyleTag(cache)` of `@umber-style/core` makes the `<style data-style="css">` element of it (see [Plain JavaScript](plain-javascript.md)). In the browser, the cache reads the style element of its key when it is made and takes its rules as written, so a class, a `@keyframes` rule or a global rule that the server sent is not written again, with nothing to call:

```ts
const server = createInstance({ key: 'page', sheet: createMemorySheet() })
const name = server.css({ color: 'red' })
document.head.insertAdjacentHTML('beforeend', createStyleTag(server.cache))

const client = createInstance({ key: 'page' })
client.css({ color: 'red' }) // name; client.sheet.rules is []
```

When the rules reach the page another way, give their ids to `hydrate`, and they are not written:

```ts
client.hydrate(ids) // the ids of the server's cache.extract()
client.css({ color: 'red', animation: `${fade} 1s` }) // the server's class name, and no rule written
client.keyframes({ to: { opacity: 0 } }) // no rule written
client.injectGlobal({ body: { margin: 0 } }) // no rule written
```

### `flush`

`flush()` removes every rule from the sheet of the instance and starts a new, empty cache over it: the classes, the global rules and the hydrated ids are forgotten, and a style is written again when it is next used. `cache` reads the new cache after it. In a browser the rules are removed from the style element.

```ts
const name = css({ margin: 2 })
flush()
// sheet.rules is [], cache.registered.size is 0
css({ margin: 2 }) // name again, and sheet.rules is ['.css-...{margin:2px;}']
```

`flush` throws a `TypeError` for an instance that was given its cache (below): other code shares it, and only its owner can empty it.

## A separate instance

`@umber-style/css/create-instance` makes an instance with its own cache, and returns the same ten functions bound to it:

```ts
import createInstance from '@umber-style/css/create-instance'

const {
  css,
  cx,
  keyframes,
  injectGlobal,
  cache,
  sheet,
  flush,
  hydrate,
  getRegisteredStyles,
  merge,
} = createInstance({ key: 'app' })
```

The options are those of the core's `createCache` (see [Options reference](options.md)), with `key` for `prefix`:

| Option        | What it does                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`         | The first part of every class name, and the key of the style element, `data-style="<key>"`. Default `css`                                            |
| `hasLayers`   | Whether rules go into cascade layers. Default `false` here                                                                                           |
| `sheet`       | Where rules go. Default: the style element of the key when there is a `document`, otherwise an in-memory sheet                                       |
| `hasRuleText` | Whether that style element holds the rules as text nodes (`textContent` shows them) or gets them with `insertRule`. Default: text outside production |
| `cache`       | A cache to share, below                                                                                                                              |
| the others    | As `createCache` takes them: `suffix`, `hasLabels`, `hasColorFallbacks`, `hasValueRepair`, `hasDevChecks` and the rest                               |

```ts
const layered = createInstance({ key: 'l', sheet: createMemorySheet(), hasLayers: true })
const name = layered.css({ color: 'red' })
// layered.sheet.rules is ['@layer l-theme,l-global,l-components,l-overrides;', `@layer l-components{.${name}{color:red;}}`]
```

### A shared cache

Give `cache` to make the classes of the instance in a cache that other code uses, an engine's for one, so that both live in one cache and one sheet, and one extraction holds both. Give the sheet that the cache writes to as `sheet`, unless the cache carries it as a `sheet` member:

```ts
const sheet = createMemorySheet()
const shared = createCache({ prefix: 'shared', sheet })
const engine = createEngine({ space: [0, 4] }, { cache: shared })
const instance = createInstance({ cache: shared, sheet })
const fromEngine = engine.css({ padding: engine.refs.space[1] })
const name = instance.css(fromEngine, { margin: 0 })
// shared.extract().css holds `.${name}{padding:var(--shared-space-1);margin:0;}`
```

The options of a shared cache are its own: the other options are not read, and a `key` that differs from its prefix throws a `TypeError`. A class of the instance is in the cache's layers when the cache has them.

## Everything `@umber-style/css` exports

| Export                                              | What it is                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `css`, `cx`, `keyframes`, `injectGlobal`            | Class names, merged class names, animation names, global rules: above               |
| `cache`, `sheet`                                    | The cache of the default instance (key `css`, no layers) and the sheet it writes to |
| `flush`, `hydrate`                                  | Empty the cache; mark rules as present                                              |
| `getRegisteredStyles`, `merge`                      | Read and merge the classes of a class string                                        |
| `@umber-style/css/create-instance` (default export) | `createInstance(options)`, a separate instance                                      |

Types: `CssFunction`, `CssInput`, `ClassNamesInput`, `KeyframesFunction`, `InjectGlobalFunction`, `InjectGlobalInput`, `CssInstance`, `InstanceOptions` and `SharedCache`, and the core's `CSSObject`, `Interpolation`, `Keyframes`, `SerializedStyles`, `Theme` and `UmberCache`, and `StyleTypeOptions`, the strict switch, re-exported so that a file needs one import (see [Typed styles](typed-styles.md)). `css` here returns a class name, a string, not the `SerializedStyles` that `css()` of a binding returns.

## Limits

- There is no theme. A token reference, a `when()` key or a function of the theme does nothing here: use `styled` and the engine for them.
- Whether a string given to `css` is CSS text or class names is decided by `:` and `{` alone. Text without either (a lone `color red`) is taken as class names, and a class name that holds `:` but was not made by this cache is taken as text. A string of CSS text is parsed again on each call; a tagged template is parsed once for its call site.
- A function in a template throws; it is not called.
- The default instance and an engine both default to the prefix `css`, and so to the same `<style data-style="css">` element. In a browser, a cache checks the options stamp that a server wrote on that element: on a page that a server rendered with an engine of the prefix `css`, importing `@umber-style/css` throws, because the options differ (the engine writes layers, this package does not). The same style also gives the same class name in both, with different rules. So the two must not share a prefix unless they share one cache: either give the engine its own prefix (`createEngine(theme, { prefix: 'app' })`), or make one cache and give it to both, as in [A shared cache](#a-shared-cache) (`createEngine(theme, { cache })` and `createInstance({ cache, sheet })`).
- `hydrate` marks ids; it does not check that their rules are on the page.
- `flush` cannot remove rules from a sheet that has no `remove` (they stay, and the new cache writes them again when they are used), nor the rules that a server sent in a style element. Each `flush` in a browser makes a new cache, which watches the head of the document for style elements as the first one did; the watch of the old one is not stopped.
- The class of `cx` and `merge` is a new class; the classes merged into it stay in the sheet.
- `getRegisteredStyles` collects style objects, not CSS text.
- What a bundler keeps of the core was checked with one bundler, for an entry that imports `css`: the engine, the tokens and the page extraction are left out; the cache, its development checks, the serializer, the keyframes and the template parser are kept (about 35 KB minified, 13 KB gzipped). Other bundlers were not tried.
- The package was run in Node and in jsdom. It was not run in a real browser by its tests.
