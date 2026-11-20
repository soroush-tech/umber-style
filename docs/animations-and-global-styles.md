# Animations and global styles

After this page you can define an animation with `keyframes` and use it in a style, write styles that are not a class (a `body` rule, a reset, a `@font-face`) with `globalStyles` and `Global`, and say when each rule is written, removed, sent by a server and taken over by the browser, on every platform.

The examples use the React binding unless they say otherwise. `keyframes`, `globalStyles` and `Global` have the same names in the Vue and React Native bindings and in `umber-style/react`; `keyframes` and `globalStyles` are also exported by `@umber-style/core`.

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

```css
@keyframes pulse-12o7gg6 {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
  }
}
@layer umber-components {
  .umber-skeleton-root-1lhil74 {
    background-color: var(--umber-palette-surface);
    animation: pulse-12o7gg6 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}
@layer umber-components {
  .umber-dot-root-1aeyf7r {
    animation-name: pulse-12o7gg6;
    animation-duration: 800ms;
    animation-iteration-count: infinite;
  }
}
```

The `@keyframes` rule is written once, though two classes use it, and outside every cascade layer: a `@keyframes` rule is looked up by name, not cascaded.

### The name

The name is `<label>-<hash>`. `label` is an option, `keyframes` by default, and must be an identifier (letters, digits, `-` and `_`, not starting with a digit or `-`); it only makes the name readable in the developer tools.

The hash is made from the steps alone. It does not depend on the theme, its values, the prefix or any option of an engine, so:

- The server and the browser make the same name, and so does every engine in the process: equal steps give one name.
- A module can call `keyframes` at its top level, before `configure()` and before there is a theme or an engine. `keyframes` from `@umber-style/core` and from every binding return the same name for the same steps.
- Steps given as a function of the theme are named by the tokens they read, not by their values: the function is called once, at the call, with a stand-in theme whose every token reads as its path.

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

```css
@keyframes blink-1l3v8jv {
  0% {
    color: red;
    opacity: 0.1;
  }
  25% {
    opacity: 0.5;
  }
  75% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}
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

```css
@keyframes slide-1ag0hl4 {
  0% {
    transform: translateY(calc(var(--umber-space-2) * 2));
    background-color: var(--umber-palette-primary);
    background-color: color-mix(in srgb, var(--umber-palette-primary) 20%, transparent);
  }
  100% {
    transform: none;
    background-color: var(--umber-palette-primary);
  }
}
@layer umber-components {
  .umber-9p42ox {
    animation: slide-1ag0hl4 200ms ease-out;
  }
}
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

```css
@layer umber-global {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}
@layer umber-global {
  html {
    -webkit-text-size-adjust: 100%;
  }
}
@layer umber-global {
  body {
    margin: 0;
    background-color: var(--umber-palette-background);
    color: var(--umber-palette-text);
  }
}
@layer umber-global {
  @media (min-width: 600px) {
    body {
      font-size: 18px;
    }
  }
}
@layer umber-global {
  @font-face {
    font-family: Inter;
    font-weight: 400;
    src: url(/inter-400.woff2);
  }
}
@layer umber-global {
  @font-face {
    font-family: Inter;
    font-weight: 700;
    src: url(/inter-700.woff2);
  }
}
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

`Global`'s `styles` (and `engine.insertGlobal`, below) takes any of these, or a list of them, written in the order of the list:

| Form                              | Example                                                  |
| --------------------------------- | -------------------------------------------------------- |
| A handle that `globalStyles` made | `reset`                                                  |
| A style object                    | `{ body: { margin: 0 } }`                                |
| A function of the theme           | `(theme) => ({ body: { color: theme.palette.text } })`   |
| A list of the three               | `[reset, { body: { margin: 0 } }, (theme) => ({ ... })]` |

A handle has an `id` (`global-<hash>`, from the styles alone, as a `keyframes` name is) and needs no engine. Each item of a list is one set of rules, named `<prefix>-global-<hash>` from its compiled rules: equal content gives one set, whatever form it was given in, and it is written once.

### What a function of the theme reads

A function gets the theme as references, as a function style does. A token is a variable, so a global rule follows a theme switch (a theme class changed on `<html>`) with no render. Keys that hold real values (`breakpoints`, raw keys, tokens in the `inline` mode) come from the provider `Global` is rendered under, and a change of them replaces the rules. A provider that changes only token values writes nothing again.

A rule for `html` or `body` that reads a token needs the variables declared on `<html>` itself, where the rule matches: put the class of the root theme there, as [The root theme and switching](root-theme.md) shows. A provider's wrapper element is below `<body>`, so its variables do not reach those two rules. In development the cache warns once when a global rule for `html`, `body` or `:root` uses a variable that has no value there.

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

The `global` layer is declared after `theme` and before `components`. A global rule beats nothing of a component: a class in the `components` or `overrides` layer wins over it whatever the specificity (a real-browser test sets `html body main p#styled` against a class, and the class wins). Unlayered CSS of your own beats it. What it does beat is the `theme` layer, which holds the `display: contents` of a provider's wrapper: a global rule that sets `display` on every `div` gives the wrapper a box. See [Cascade layers and overrides](cascade-layers.md).

With `hasLayers: false` the rules are written outside every layer, in the order they are inserted, among the classes: the usual cascade decides, so a global rule written after a class can beat it at equal specificity.

## On a server

A server unmounts nothing. Everywhere below, the rules of a `Global` that renders on a server are written into the cache for good, and the cache is shared by every request it serves: global rules are app-wide on a server.

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

the markup starts with one merged element (shown shortened):

```html
<style
  data-precedence="umber"
  data-href="umber-theme-188kecs umber-scope umber-global-a3061a fade-1acbpvw umber-toast-root-1atv36o"
>
  ...
  @layer umber-global{body{margin:0;color:var(--umber-palette-text);}}
  @keyframes fade-1acbpvw{0%{opacity:0;}100%{opacity:1;}}
  ...
  @layer umber-components{.umber-toast-root-1atv36o{animation:fade-1acbpvw 200ms ease-out;}}
</style>
```

`extractPageStyles(cache, html)` leaves out what the markup carries (it reads `data-href`), so its `tag` holds only the stamp here. With `hasServerStyleElements: false` the markup has no style element, and `extractPageStyles` returns the whole page in one:

```css
@layer umber-theme, umber-global, umber-components, umber-overrides;
@keyframes fade-1acbpvw {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@layer umber-theme {
  .umber-theme-188kecs {
    --umber-palette-text: #1a1a1a;
  }
}
@layer umber-global {
  body {
    margin: 0;
    color: var(--umber-palette-text);
  }
}
@layer umber-theme {
  .umber-scope {
    display: contents;
  }
}
@layer umber-components {
  .umber-toast-root-1atv36o {
    animation: fade-1acbpvw 200ms ease-out;
  }
}
```

What `extractPageStyles` puts in a page:

- **Global rules: all of them**, every set the cache holds, in the order they were written, whatever page wrote them. No class stands for a global rule, so the page cannot tell which it needs.
- **`@keyframes` rules: only those the page uses**, the animations of the classes in the markup and of the global rules, sorted by name. A rule of a class that is not on the page is not sent.
- **`animations`**: names to include although nothing on the page uses them, for a use the engine cannot see (see `insertKeyframes` above):

```ts
const spin = keyframes({ to: { rotate: '1turn' } }, { label: 'spin' })
const { css } = extractPageStyles(cache, '<p>An empty page</p>', { animations: [spin] })
```

`css` is the layer order, `@keyframes spin-1jqe2jv{100%{rotate:1turn;}}` and the global rule of `base`: the global rule is there although this page never rendered `Global`.

The variables that global rules and `@keyframes` rules use count as used by every page, so the theme classes of a page declare them.

### Vue

`Global` renders nothing on a server either (a comment node, as any component that renders nothing). Its rules and the animations they use are in `extractPageStyles(cache, html).css`, with the rules of the classes:

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

```css
@layer umber-theme, umber-global, umber-components, umber-overrides;
@keyframes fade-1acbpvw {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@layer umber-global {
  body {
    color: var(--umber-palette-text);
  }
}
@layer umber-components {
  .umber-toast-root-1atv36o {
    animation: fade-1acbpvw 200ms ease-out;
  }
}
```

### Server components

The server components build of the React binding has `keyframes`, `globalStyles` and `Global` too. `Global` there has no hook: a function of the theme reads the root theme of the request (references for tokens, real values for raw keys), which is the base theme when no provider rendered. For each set it renders a `<style href precedence>` element for each animation the set uses (the name as `href`), then the set's own (the id as `href`, the layer order statement first). A styled server component that uses an animation sends the animation in an element of its own before its class. React sends each `href` once, however many elements render it (`Global.server.test.tsx`).

In the browser nothing unmounts a server component's `Global`: its rules came as style elements, which React keeps for the life of the document. A global rule that a page renders in a server component stays after a client-side navigation away from that page (the Next.js fixture checks it). Put a `Global` that must be removed in a client component.

### Hydration

The browser's cache reads the page when it is made, and each style element that arrives later. A `@keyframes` rule the page has is not written again. A global rule the page has is taken over: when a `Global` with the same content mounts, it holds the rule without writing it, and when it unmounts the rule is deleted from the page's style element. A browser that hydrates a server page therefore writes no global or `@keyframes` rule again. This is checked in tests (`hydrateGlobal.test.tsx`, Vue's `Global.test.ts`) and end to end in every fixture app with a server render.

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
- Timeline range offsets (`entry 10%`, `exit 50%`) are not steps: `keyframes` throws for them. Only `from`, `to` and percentages are.
- A function of the theme that iterates a theme value is not supported. It is called with a stand-in theme for its name, and the stand-in has no keys and is not a list: `Object.keys(view.palette)` is empty there, and the result of `view.space.map(...)` is not a list either, so using it as one throws a `TypeError` at the call. For `keyframes` an empty iteration is worse than an error: two functions that iterate get one name, and the steps of the first are written for both (observed: the rule of the second function held the variables of the first). Write the steps out, or build them outside the function. A `globalStyles` handle that iterates gets an `id` that does not reflect what it writes, but its rules are written correctly.
- Raw values in steps (breakpoints, `inline` tokens) come from the base theme, not from the nearest provider.
- Without layers (`hasLayers: false`) a global rule that is written after a class beats it at equal specificity: the rules are only in the order they were inserted. This is the cascade's order rule, seen in the rule text and its order; it was not run in a browser.
- On a server, global rules are app-wide and never removed. A cache that serves many requests keeps every set it was given: a `Global` whose raw values (a breakpoint, an `inline` token) differ from one request to another leaves each variant in the cache, and every later page extracted from it carries all of them.
- In the browser, a `Global` of a server component is never removed (React keeps its style element).
- There is no development warning for an animation name that has the engine's form and is not registered: the engine's names cannot be told from ordinary names such as `fade-in`. `insertKeyframes` with an unknown name throws.
- The types check the keys of a step (a misspelt property and a nested style are errors) and the style under a selector of global styles, but not a step key: `keyframes({ middle: { ... } })` compiles and throws when it runs.
- React Native runs no animation yet: `keyframes` there is a name only, and `animation*` and `transition*` keys are dropped.
- Rules that came from a server page and that the browser cannot match to the text it read (a style element whose rules the browser did not all keep) cannot be deleted: when their `Global` unmounts they stay.
- A running animation was checked in Chromium only (`keyframes.browser.test.ts` and the fixture apps end to end); other browsers were not run.
