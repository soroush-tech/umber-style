# Animations and global styles

After this page you can define an animation with `keyframes` and use it in a style, write styles that are not a class (a `body` rule, a reset, a `@font-face`) with `globalStyles` and `Global`, and say when each rule is written, removed, sent by a server and taken over by the browser, on every platform.

The examples use the React binding unless they say otherwise. `keyframes`, `globalStyles` and `Global` have the same names in the Vue and React Native bindings and in `umber-style/react`; `keyframes` and `globalStyles` are also exported by `@umber-style/core`. `@umber-style/css` has a `keyframes` and an `injectGlobal` of its own, with no theme: see [Class names without a theme](css.md).

## An animation: `keyframes`

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', surface: '#eef2f8' },
  space: [0, 4, 8, 16],
}

const { styled, keyframes } = createStyle(theme, { prefix: 'umber' })

const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })

const Skeleton = styled('div', { name: 'Skeleton' })(({ theme }) => ({
  backgroundColor: theme.palette.surface,
  animation: `${pulse} 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
}))

const Dot = styled('span', { name: 'Dot' })({
  animationName: pulse,
  animationDuration: 800,
  animationIterationCount: 'infinite',
})
```

`keyframes` returns the name of the animation at once: `pulse` is `'pulse-12o7gg6'`, a plain string. Use it inside the `animation` shorthand, as `Skeleton` does, or as the value of `animationName`, as `Dot` does. Rendering both writes:

```text
@keyframes pulse-12o7gg6{0%{opacity:1;}50%{opacity:0.4;}100%{opacity:1;}}
@layer umber-components{.umber-skeleton-root-1lhil74{background-color:var(--umber-palette-surface);animation:pulse-12o7gg6 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;}}
@layer umber-components{.umber-dot-root-1aeyf7r{animation-name:pulse-12o7gg6;animation-duration:800ms;animation-iteration-count:infinite;}}
```

The `@keyframes` rule is written once, though two classes use it, and outside every cascade layer: a `@keyframes` rule is looked up by name, not cascaded.

### The name

The name is `<label>-<hash>`. `label` is an option, `keyframes` by default, and must be an identifier (letters, digits, `-` and `_`, not starting with a digit or `-`); it only makes the name readable in the developer tools.

The hash is made from the steps alone. It does not depend on the theme, its values, the prefix or any option of an engine, so:

- The server and the browser make the same name, and so does every engine in the process: equal steps give one name.
- A module can call `keyframes` at its top level, before `configure()` and before there is a theme or an engine. `keyframes` from `@umber-style/core` and from every binding return the same name for the same steps.
- Steps given as a function of the theme are named by the tokens they read, not by their values: the function is called once, at the call, with a stand-in theme whose every token reads as its path. Listing the keys of that stand-in throws (see Limits).

### The template form

`keyframes` can also be used as a tag. The template is the steps written as CSS text, read as a template of `styled` is (see [Writing styles](writing-styles.md)), and the name is the one of the equal object:

```ts
const fade = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`
// fade === keyframes({ from: { opacity: 0 }, to: { opacity: 1 } })
```

A function among the interpolations is called with `{ theme }`, so `${({ theme }) => theme.palette.primary}` makes the steps a function of the theme. The template form takes no options: a template is named with the default label. It is the same in `@umber-style/core` and in every binding, and it can be called before `configure()` too.

### The steps

A key is `from`, `to`, a percentage from `0%` to `100%` (`'33.5%'` and `'.5%'` too), or a comma list of them (`'0%, 100%'`). A step holds declarations only, written as in a class: camelCase keys, numbers in `px` where CSS takes a length, a list for fallbacks, custom properties, `alpha()` with its fallback. Before the rule is written the steps are put in order: lists are expanded, `from` and `to` are `0%` and `100%`, the steps are sorted, steps of one offset are merged with the later one winning, and a step that declares nothing is left out. Equal steps written in another order are the same steps and get the same name.

```ts
const blink = keyframes(
  {
    to: { opacity: 1 },
    '25%, 75%': { opacity: 0.5 },
    from: { opacity: 0, color: 'red' },
    '0%': { opacity: 0.1 },
  },
  { label: 'blink' }
)
```

```text
@keyframes blink-1l3v8jv{0%{color:red;opacity:0.1;}25%{opacity:0.5;}75%{opacity:0.5;}100%{opacity:1;}}
```

A key that is not a step, a nested style in a step, steps that are not an object and a label that is not an identifier throw a `TypeError`, in every build:

```text
TypeError: keyframes(): "entry 10%" is not a step: use from, to, a percentage from 0% to 100%, or a comma list of them.
TypeError: keyframes(): the step "from" holds "&:hover", a nested style (a selector or an at-rule). A step is flat: it holds declarations only.
```

### Tokens and arithmetic in steps

Give a function of the theme to use tokens. It gets the references, as a function style does, so the arithmetic helpers and `alpha` work in a step:

```ts
import { alpha, createEngine, multiply } from '@umber-style/core'

const engine = createEngine(theme, { prefix: 'umber' })

const slide = engine.keyframes(
  (view) => ({
    from: {
      transform: `translateY(${multiply(view.space[2], 2)})`,
      backgroundColor: alpha(view.palette.primary, 0.2),
    },
    to: { transform: 'none', backgroundColor: view.palette.primary },
  }),
  { label: 'slide' }
)

const className = engine.css({ animation: `${slide} 200ms ease-out` })
```

```text
@keyframes slide-1ag0hl4{0%{transform:translateY(calc(var(--umber-space-2) * 2));background-color:var(--umber-palette-primary);background-color:color-mix(in srgb, var(--umber-palette-primary) 20%, transparent);}100%{transform:none;background-color:var(--umber-palette-primary);}}
@layer umber-components{.umber-9p42ox{animation:slide-1ag0hl4 200ms ease-out;}}
```

The function is called again when the rule is written, with the references of the engine. A token in a step is a variable, so the animation follows a theme switch like any rule. A key that holds real values (`breakpoints`, a raw key, a token in the `inline` mode) is read from the base theme of the engine, not from the nearest provider: one name is one rule for the whole page. `hasValueRepair` rewrites the string forms of token maths in a step as it does in a class: see [Tokens](tokens.md). The variables a step uses count as used, so a theme class declares them.

### Where the engine finds the name

When a class is compiled, the engine looks for the names it made in the values of `animation` and `animation-name`, in the rule of the class and in its nested selectors and at-rules, as whole identifiers:

| Written                                                                | Found                                |
| ---------------------------------------------------------------------- | ------------------------------------ |
| `animation: '<name> 1s cubic-bezier(0.1, 0.7, 1, 0.1) 200ms infinite'` | yes, past the commas of the function |
| `animation: '<a> 1s, <b> 2s ease-in'`                                  | both                                 |
| `animationName: '<a>, <b>'`                                            | both                                 |
| `'&:hover': { animationName: name }`, inside `@media`                  | yes                                  |
| `animation: '<name>ner 1s'`, `'<name>-2'`, `'x<name>'`                 | no: not the whole identifier         |
| `WebkitAnimation`, `'--animation'`, `content`, `transition`            | no: only the two properties above    |

A name that `keyframes` did not make is passed through untouched, so an animation of your own stylesheet (`animation: 'fade-in 1s'`) works as it always did.

### When the rule is written

- The call writes nothing.
- The rule is written once, when the first class that uses the name is inserted, before the rules of that class. A name that no class uses is never written.
- Steps that are a function of the theme are resolved then. With an engine that has no theme yet (`createLazyEngine`), a class that uses such a name throws until the theme is set.
- A global rule that uses a name writes it too, before the global rule (see below).

For a use the engine cannot see (a name in CSS of your own, a class that a script adds, an animation given to the browser in some other way), write the rule yourself:

```ts
engine.insertKeyframes(blink)
```

It writes the rule now, once; a rule that is written, or that the page has, is not written again. A name that `keyframes` did not return throws a `TypeError`: `insertKeyframes(): "fade-in" is not a name that keyframes() returned, so there is no rule to write.` On a server, name the animation for one page in `extractPageStyles` (see "On a server" below).

### Times in `ms`

A number for `animationDuration`, `animationDelay`, `transitionDuration` or `transitionDelay` is a time in milliseconds, `0` included: `{ transitionDuration: 150, transitionDelay: 0, animationDelay: 50 }` is written `transition-duration:150ms;transition-delay:0ms;animation-delay:50ms;`. The same holds in a step and in a global rule. A string is written as it is (`'1.5s'`). Inside a shorthand string a time is yours to write with its unit.

## Global styles: `globalStyles` and `Global`

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { background: '#ffffff', text: '#1a1a1a' },
  breakpoints: ['600px', '900px'],
}

const { Global, ThemeProvider, globalStyles } = createStyle(theme, { prefix: 'umber' })

const reset = globalStyles({
  '*, *::before, *::after': { boxSizing: 'border-box' },
  html: { WebkitTextSizeAdjust: '100%' },
})

const base = globalStyles((theme) => ({
  body: { margin: 0, backgroundColor: theme.palette.background, color: theme.palette.text },
  [`@media (min-width: ${theme.breakpoints[0]})`]: { body: { fontSize: 18 } },
  '@font-face': [
    { fontFamily: 'Inter', fontWeight: 400, src: 'url(/inter-400.woff2)' },
    { fontFamily: 'Inter', fontWeight: 700, src: 'url(/inter-700.woff2)' },
  ],
}))

const App = () => (
  <ThemeProvider theme={theme}>
    <Global styles={[reset, base]} />
    <main>Hello</main>
  </ThemeProvider>
)
```

`globalStyles` returns a handle and writes nothing, so a module can make one at its top level. `Global` renders nothing in the browser and writes the rules of its `styles`, in the order of the list, into the `global` layer:

```text
@layer umber-global{*,*::before,*::after{box-sizing:border-box;}}
@layer umber-global{html{-webkit-text-size-adjust:100%;}}
@layer umber-global{body{margin:0;background-color:var(--umber-palette-background);color:var(--umber-palette-text);}}
@layer umber-global{@media (min-width: 600px){body{font-size:18px;}}}
@layer umber-global{@font-face{font-family:Inter;font-weight:400;src:url(/inter-400.woff2);}}
@layer umber-global{@font-face{font-family:Inter;font-weight:700;src:url(/inter-700.woff2);}}
```

### Keys

| Key                                                                                     | Holds                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A selector: `body`, `html, body`, `*, *::before, *::after`, `#root`, `main [id]`        | A style, written as a class's is: nested keys with `&` stand for the selector, vendor-prefixed keys (`WebkitTextSizeAdjust`) are written `-webkit-...` |
| `@media`, `@supports`, `@container`, `@layer`, `@scope`, `@starting-style`, `@document` | Selectors as keys, each with its style                                                                                                                 |
| Any other at-rule: `@font-face`, `@page`, `@counter-style`, `@font-palette-values`      | Descriptors, camelCase                                                                                                                                 |
| A list under any key                                                                    | One rule for each item, in order: an object cannot hold `@font-face` twice                                                                             |

`null`, `undefined` and `false` under a key are skipped. A key that holds something else (a string, a number) throws a `TypeError`.

### What `styles` takes

`Global`'s `styles` (and `engine.insertGlobal`, below) takes any of these, or a list of them, nested to any depth, written in the order of the list:

| Form                                                  | Example                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| A handle that `globalStyles` made                     | `reset`                                                      |
| A style object                                        | `{ body: { margin: 0 } }`                                    |
| A `css()` value, of an object or a template           | `` css`html, body { margin: 0; }` ``                         |
| A function of the theme that returns any of the above | `` (theme) => css`body { color: ${theme.palette.text}; }` `` |
| A list of any of them                                 | `[reset, { body: { margin: 0 } }, (theme) => ({ ... })]`     |
| Nothing: `null`, `undefined`, `false`, also in a list | `isFramed && frame`                                          |

A `css()` value is read as global rules: each of its nested rules is a rule as it is written, so `` css`html, body { margin: 0; }` `` writes `html,body{margin:0;}`, not `.class html{...}`, and an at-rule around a selector (`` css`${theme.breakpoints.up('lg')} { main [id] { scroll-margin-top: 5rem; } }` ``, the helper returning `@media (min-width: 1200px)`) writes `@media (min-width: 1200px){main [id]{scroll-margin-top:5rem;}}`. A comment in the template is left out. A declaration of the value itself, outside every selector (`` css`color: red; body { margin: 0; }` ``), has no selector to go under in a global rule: it is left out, and with the development checks it is warned about once, with the label of the value when it has one. Anything else (a string, a number) throws a `TypeError`; nothing is dropped without a word. The same value used as a class (`apply`, the `style` prop) is a class: there its nested rules are descendants of the class, and its `styles` text reads them that way (`& html{margin:0;}`); see [Style sheets](style-sheets.md). The tests with the shape of an app's reset (a selector list, a comment, an at-rule whose prelude is an interpolation, theme values in declarations, alone and in a list with an object) are `Global.css.test.tsx` and, through a `CacheProvider` and `@umber-style/server`, `appSetUp.test.tsx` of the server package.

A handle has an `id` (`global-<hash>`, from the styles alone, as a `keyframes` name is) and needs no engine. A handle of styles given as an object or a template also has `styles`, the CSS text of its rules as global rules, made on first read and written nowhere: `globalStyles({ 'html, body': { margin: 0 } }).styles` is `html,body{margin:0;}` (the text format of [How it works](how-it-works.md#the-text-of-a-rule), with the defaults of a cache and no layer). A handle of a function of the theme has none (`undefined`): its rules need the theme of an engine. Which text reads how: the `styles` of a `css()` value reads as the class would write it, `& html,& body{margin:0;}`, because a `css()` value is a class wherever it is not given to `Global`; the `styles` of a `globalStyles` handle reads as global rules; and `Global` writes global rules from either. `globalStyles` can also be used as a tag, with selectors and at-rules written as CSS text (`` globalStyles`body { margin: 0; }` ``); a function among its interpolations is called with `{ theme }`. Under a selector a `css()` value is taken as its style (`{ body: card }`). Each item of a list is one set of rules, named `<prefix>-global-<hash>` from its compiled rules: equal content gives one set, whatever form it was given in, and it is written once.

### What a function of the theme reads

A function gets the theme as references, as a function style does. A token is a variable, so a global rule follows a theme switch with no render: a new theme given to the outermost provider, which rewrites its `:root` rule, or a theme class changed on `<html>`. Keys that hold real values (`breakpoints`, raw keys, tokens in the `inline` mode) come from the provider `Global` is rendered under, and a change of them replaces the rules. A provider that changes only token values writes nothing again.

A rule for `html` or `body` that reads a token sees the variables declared on `<html>` itself, where the rule matches. By default there is nothing to do: the outermost provider declares its theme on `:root`, which is `<html>`, so a `body` rule under it has its values (a real-browser test, `themeProvider.browser.test.tsx`, reads the colour of `body` from a `Global` under the outermost provider). Two set-ups differ:

- **`isRoot`.** The provider declares nothing. Put the class of the root theme (`themeClass(theme)`) on `<html>`, as [The root theme and switching](root-theme.md) shows. A class on `<html>` also wins over the `:root` rule of an outermost provider.
- **A nested provider.** Its variables are declared on its wrapper element, which is below `<body>`: they do not reach a rule for `html` or `body`. A `Global` under it reads the real values of that provider, but its tokens take the values on `<html>`, those of the root theme.

In development the cache warns once when a global rule for `html`, `body` or `:root` uses a variable that has no value there: no outermost provider declares its theme on `:root`, and no theme class is on `<html>`.

### Mount, change, unmount

In the browser a `Global` writes its rules when it mounts (React: an insertion effect, before the page paints; Vue: in `setup`, before it mounts) and removes them when it unmounts. When its rules change (its `styles`, or a real value of the theme they read) it writes the new rules first and then removes the old ones, so there is no moment with neither. The order of what reaches the sheet, logged by a test (`Global.test.tsx`):

```text
+body{margin:0;}
+body{margin:8px;}
-body{margin:0;}
```

- Rules are counted: two `Global` elements with equal content share one set, which is removed when the last of them unmounts. A React effect that runs twice in development (strict mode) writes them once.
- The `@keyframes` rules that global rules use are written before them and stay when the global rules are removed: a class may use them too.
- Rules that came with the page from a server are taken over, not written again, and removed from the page's style element on unmount (see "Hydration").
- Classes are never removed. Global rules are, so a `Global` can belong to one part of the app, such as a dialog that stops `body` from scrolling while it is open.

### Without a framework

```ts
import { createEngine, globalStyles } from '@umber-style/core'

const theme = { palette: { text: '#1a1a1a' } }
const engine = createEngine(theme, { prefix: 'umber' })

const base = globalStyles((view: typeof theme) => ({ body: { color: view.palette.text } }))
const release = engine.insertGlobal(base)
```

`engine.insertGlobal(styles, theme?)` takes what `Global` takes, writes the rules and returns the function that releases them; the rules stay until it is called. A function of the theme reads the theme view you give as the second argument (`engine.createThemeView(realTheme)`), else the references and real values of the base theme. `engine.resolveGlobal(styles, theme?)` gives the sets (`{ id, rules, animations }`) and writes nothing:

```json
[
  {
    "id": "umber-global-1k672ui",
    "rules": ["@layer umber-global{body{color:var(--umber-palette-text);}}"],
    "animations": []
  }
]
```

`cache.compileGlobal` and `cache.insertGlobal` are the same for one style object and one set, under the engine.

### Where global rules sit in the cascade

The `global` layer is declared after `theme` and before `components`. A global rule beats nothing of a component: a class in the `components` or `overrides` layer wins over it whatever the specificity (a real-browser test sets `html body main p#styled` against a class, and the class wins). Unlayered CSS of your own beats it. What it does beat is the `theme` layer, which holds the `display: contents` of a nested provider's wrapper: a global rule that sets `display` on every `div` gives the wrapper a box. See [Cascade layers and overrides](cascade-layers.md).

With `hasLayers: false` the rules are written outside every layer, in the order they are inserted, among the classes: the usual cascade decides, so a global rule written after a class can beat it at equal specificity.

## On a server

A server unmounts nothing. Everywhere below, the rules of a `Global` that renders on a server are written into the cache for good, and the cache is shared by every request it serves. They are still the rules of the page that rendered them: the markup of a page says which sets it rendered (the style elements it carries, or a marker that `Global` leaves in their place), and the CSS extracted for a page holds those sets and no other set of a `Global`. A set written with `engine.insertGlobal`, with no component, is for the app: it is in every page.

A set-up that collects the rules itself, through `@umber-style/cache` and `@umber-style/server`, gets a set of global rules and a `@keyframes` rule as a group of its own, named `<prefix>-global-<hash>` and `@keyframes:<name>`: see [The cache and server packages](cache-and-server.md).

### Classic server render

With React's client build on a server (`renderToString`, Vike, the Next.js Pages Router), `Global` renders one `<style href precedence>` element for each set, its id as `href`, after an element for each animation the set uses, its name as `href`. A styled class that uses an animation renders the animation's element before its own. React hoists them and sends each `href` once, so a `@keyframes` rule that many classes use is sent once. For this app, with the theme of the example above:

```tsx
import { renderToString } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from '@umber-style/react'

const { styled, keyframes, Global, ThemeProvider, globalStyles, cache } = createStyle(theme, {
  prefix: 'umber',
})

const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fade' })
const base = globalStyles((theme) => ({ body: { margin: 0, color: theme.palette.text } }))
const Toast = styled('div', { name: 'Toast' })({ animation: `${fade} 200ms ease-out` })

const App = () => (
  <ThemeProvider theme={theme}>
    <Global styles={base} />
    <Toast>Saved</Toast>
  </ThemeProvider>
)

const html = renderToString(<App />)
```

the markup starts with one merged element (shown shortened), then the options stamp and the `div` of `Toast`. The outermost provider renders no element of its own: its theme comes as `umber-root-188kecs`, the rule on `:root` with every variable of the theme:

```html
<style
  data-precedence="umber"
  data-href="umber-root-188kecs umber-global-a3061a fade-1acbpvw umber-toast-root-1atv36o"
>
  ...
  @layer umber-theme{:where(:root){--umber-palette-background:#ffffff;--umber-palette-text:#1a1a1a;}}
  ...
  @layer umber-global{body{margin:0;color:var(--umber-palette-text);}}
  @keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}
  ...
  @layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}
</style>
```

`extractPageStyles(cache, html)` leaves out what the markup carries (it reads `data-href`), so its `tag` holds only the stamp here. With `hasServerStyleElements: false` the markup has no style element. `Global` renders its marker in their place, a `<meta>` that names its sets, which React moves to the head (in the markup of `renderToString`, to its start):

```html
<meta name="umber-global" content="umber-global-a3061a" />
```

`extractPageStyles` reads it and returns the whole page in one:

```text
@layer umber-theme,umber-global,umber-components,umber-overrides;
@keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}
@layer umber-theme{:where(:root){--umber-palette-text:#1a1a1a;}}
@layer umber-global{body{margin:0;color:var(--umber-palette-text);}}
@layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}
```

What `extractPageStyles` puts in a page:

- **Global rules: those of the page**, in the order they were written: each set that a `Global` of this page rendered (a style element the markup carries, or a set its marker names), and each set that `engine.insertGlobal` wrote for the app. A set that only another page rendered is not sent, whichever page the server rendered first, and pages rendered at the same time each get their own.
- **`@keyframes` rules: only those the page uses**, the animations of the classes in the markup and of the global rules of the page, sorted by name. A rule of a class that is not on the page is not sent.
- **`animations`**: names to include although nothing on the page uses them, for a use the engine cannot see (see `insertKeyframes` above):

```ts
const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
const { css } = extractPageStyles(cache, '<p>An empty page</p>', { animations: [spin] })
```

`css` is `@keyframes spin-1jqe2jv{100%{rotate:1turn;}}` and nothing else: the global rule of `base` is not there, because this page did not render the `Global` that wrote it, and the `:root` rule of the last render declares only the variables that the page uses, here none (see [Server rendering](server-rendering.md) for the root theme of a page). A rule that every page needs and that no component renders, such as a reset written at start-up, is written with `engine.insertGlobal(reset)`: it is in the CSS of every page.

The variables that the global rules and `@keyframes` rules of a page use count as used by that page, so its theme classes declare them.

### Vue

Vue has no style elements. On a server `Global` renders a comment, as any component that renders nothing does, and its text is the marker of its sets: `<!--umber-global umber-global-1k672ui-->`. A hydration does not compare the text of a comment, and the browser's `Global` renders an empty one. Its rules and the animations they use are in `extractPageStyles(cache, html).css`, with the rules of the classes:

```ts
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from '@umber-style/vue'

const theme = { palette: { text: '#1a1a1a' } }
const { Global, styled, keyframes, cache } = createStyle(theme, { prefix: 'umber' })
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { label: 'fade' })
const Toast = styled('div', { name: 'Toast' })({ animation: `${fade} 200ms ease-out` })

const app = createSSRApp({
  render: () => [
    h(Global, { styles: (view: typeof theme) => ({ body: { color: view.palette.text } }) }),
    h(Toast, null, () => 'Saved'),
  ],
})
const html = await renderToString(app)
const { css } = extractPageStyles(cache, html)
```

```text
@layer umber-theme,umber-global,umber-components,umber-overrides;
@keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}
@layer umber-global{body{color:var(--umber-palette-text);}}
@layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}
```

### Server components

The server components build of the React binding has `keyframes`, `globalStyles` and `Global` too. `Global` there has no hook: a function of the theme reads the root theme of the request (references for tokens, real values for raw keys), which is the base theme when no provider rendered. For each set it renders a `<style href precedence>` element for each animation the set uses (the name as `href`), then the set's own (the id as `href`, the layer order statement first). A styled server component that uses an animation sends the animation in an element of its own before its class. React sends each `href` once, however many elements render it (`Global.server.test.tsx`).

A server component never runs in the browser, and its rules come as style elements, which React keeps for the life of the document. So after its style elements `Global` renders `GlobalRelease`, a client component of the package (a `'use client'` file: the server build imports a reference to it), with the prefix and the sets as plain data. In the browser it finds the cache of that prefix (`findCache(prefix, document)` of `@umber-style/core`: the first cache made with a sheet in that document, which the client build of the app made) and lets it take the rules over, as a client `Global` does with the rules of a server page (see "Hydration"). When the page is left in a client-side navigation it unmounts, and the cache deletes the rules from the sheet of React's element; when the page is reached again, React does not send the element again, and the cache writes the rules itself. A `Global` in a root layout never unmounts, and its rules stay on every page. The Next.js fixture checks both, the second as scenario M.

The text of React's element keeps the deleted rules. They cannot come back: a browser parses the text of a style element again only when the element is inserted into the document again or its text changes, and React neither moves nor rewrites a style element that is in the head (the element of a streamed boundary is moved once, from the body to the head, before any component of the boundary mounts). Where the page has no cache of the prefix (no client component made one), `GlobalRelease` does nothing and the rules stay.

### Hydration

The browser's cache reads the page when it is made, and each style element that arrives later in the head (the `data-umber` elements of `@umber-style/server` and of a registry too). Before it takes a global rule over, it reads the elements that arrived since its watch of the head last reported, so an element that React inserts in the commit that mounts the component is found. A style element that React streams with a late boundary waits in the body with `media="not all"` and is moved to the head when the boundary is revealed, which parses it again: the cache reads it there. A `@keyframes` rule the page has is not written again. A global rule the page has is taken over: when a `Global` with the same content mounts, it holds the rule without writing it, and when it unmounts the rule is deleted from the page's style element. A browser that hydrates a server page therefore writes no global or `@keyframes` rule again. This is checked in tests (`hydrateGlobal.test.tsx`, Vue's `Global.test.ts`) and end to end in every fixture app with a server render.

## Vue

The Vue binding has the same three names. `Global` is a component that takes the same `styles` prop and renders nothing:

```ts
import { createApp, defineComponent, h, ref } from 'vue'
import { createStyle } from '@umber-style/vue'

const theme = { palette: { background: '#ffffff', text: '#1a1a1a' } }
const { Global, globalStyles } = createStyle(theme, { prefix: 'umber' })

const base = globalStyles((theme) => ({
  body: { margin: 0, backgroundColor: theme.palette.background, color: theme.palette.text },
}))

const isFramed = ref(true)
const App = defineComponent({
  setup: () => () => [
    h(Global, { styles: base }),
    isFramed.value ? h(Global, { styles: { body: { borderTop: '4px solid' } } }) : null,
  ],
})

createApp(App).mount('#app')
```

Setting `isFramed.value = false` removes the `border-top` rule after the next tick and keeps the other. `Global` reads the theme of the nearest `ThemeProvider` through its injection, and replaces its rules when what they read changes; a change of token values alone writes nothing.

## React Native

React Native has no style sheet to write to and no CSS animation, so the names exist only for one source to compile and run on both platforms:

- `keyframes` returns the name, the same as on the web for the same steps, and registers nothing that is ever written.
- `globalStyles` returns a handle, and `Global` renders nothing and does nothing.
- The `animation*` and `transition*` keys of a style are dropped, in the shared style and in its `native` part.

From the repository's test of one source on both platforms (`sharedAnimation.test.tsx`):

```tsx
function createSource({
  keyframes,
  globalStyles,
}: Pick<SharedStyle<AppTheme>, 'keyframes' | 'globalStyles'>) {
  const pulse = keyframes(
    { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
    { label: 'pulse' }
  )
  const base = globalStyles((view) => ({ body: { margin: 0, color: view.palette.text } }))
  const skeleton: SharedStyleObject = {
    opacity: 1,
    web: { animation: `${pulse} 1.5s ease-in-out infinite` },
  }
  return { pulse, base, skeleton }
}
```

On the web the skeleton animates and `body` gets its rule. On React Native the component's style is `[{ opacity: 1 }]` and `Global` renders nothing. Put the animation in the `web` part of a shared style: an `animation` key in the shared part is not in the shared types.

## Limits

- `@import` is not supported. A key `@import` is written as an at-rule with declarations, which is not valid CSS; put an `@import` in a stylesheet of your own.
- The template form of `keyframes` takes no `label`. A template of `globalStyles` holds rules only: a declaration at its top level is an error, as a key that holds no style is.
- A `css()` value under a selector of `globalStyles` at module level makes the default style's engine: see the limits of [Style sheets](style-sheets.md).
- Timeline range offsets (`entry 10%`, `exit 50%`) are not steps: `keyframes` throws for them. Only `from`, `to` and percentages are.
- A function of the theme given to `keyframes` or `globalStyles` cannot iterate the theme. It is called with a stand-in theme for its name, before the theme is known. Listing the keys of a part of it (`Object.keys`, a spread, `for...in`) throws at the call, in every build:

  ```text
  TypeError: A function of the theme given to keyframes() or globalStyles() cannot list the keys of "palette" (Object.keys, a spread, for...in): its name is made before the theme is known. Read each token by its key.
  ```

  Iterating a list (`[...view.space]`, `for...of`) throws `TypeError: view.space is not iterable`. A method call on a theme value (`view.space.map(fn)`) does not throw: the stand-in names it by the text of its arguments, and the rule is written with the references. Two such calls of one text whose closures differ get one name, and the steps of the first are written for both (observed: two `keyframes` made by one helper with a factor of 1 and of 2 got one name, and the rule held the factor 1). Write the steps out, or build them outside the function.

- A `Global` under a nested provider gets the tokens' values on `<html>`, not those of the provider: a variable declared on the wrapper does not reach `body`. This is how a custom property is inherited; it was not run in a browser.
- Raw values in steps (breakpoints, `inline` tokens) come from the base theme, not from the nearest provider.
- Without layers (`hasLayers: false`) a global rule that is written after a class beats it at equal specificity: the rules are only in the order they were inserted. This is the cascade's order rule, seen in the rule text and its order; it was not run in a browser.
- On a server, global rules are never removed from the cache. A cache that serves many requests keeps every set it was given: a `Global` whose raw values (a breakpoint, an `inline` token) differ from one request to another leaves each variant in the cache. A page gets only the sets its markup names, so this costs memory, not bytes of the page.
- A page's sets are read from the markup given to `extractPageStyles`: a `Global` whose element or marker is not in that markup (a part of the page rendered and extracted apart) is not in its CSS. A set of `engine.insertGlobal` is in every page, also one that does not use it.
- The marker of React is a `<meta>` in the head, and that of Vue a comment; both are in the HTML a server sends, also where a page's style is extracted. They were checked to hydrate with no warning in React's development build and in Vue (`hydrateGlobal.test.tsx`, Vue's `Global.test.ts`), not in other versions.
- In the browser, the rule of a server component's `Global` is removed when its page is left only where a cache of its prefix exists: an app with no client component that made one keeps the rule. A style element that code of the app moves or rewrites after the cache read it is parsed again: rules that were deleted from it come back, and rules the cache took over from it can no longer be deleted.
- Two caches of one prefix in one document read the same page; `findCache` gives the first, and a `Global` of a server component is released through it.
- There is no development warning for an animation name that has the engine's form and is not registered: the engine's names cannot be told from ordinary names such as `fade-in`. `insertKeyframes` with an unknown name throws.
- The types check the keys of a step (a misspelt property and a nested style are errors) and the style under a selector of global styles, but not a step key: `keyframes({ middle: { ... } })` compiles and throws when it runs.
- React Native runs no animation yet: `keyframes` there is a name only, and `animation*` and `transition*` keys are dropped.
- Rules that came from a server page and that the browser cannot match to the text it read (a style element whose rules the browser did not all keep) cannot be deleted: when their `Global` unmounts they stay.
- A running animation was checked in Chromium only (`keyframes.browser.test.ts` and the fixture apps end to end); other browsers were not run.
