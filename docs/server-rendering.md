# Server rendering

After this page you can render a themed page on the server, send its CSS with it, hydrate it in the browser without repeating a rule, and use the server components build of the React binding.

There are four cases, and they use different parts of the engine:

| Case                                                    | What renders                            | How the CSS reaches the page                                                                        |
| ------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Static page                                             | `renderToStaticMarkup`, no client JS    | `extractPageStyles(cache, html).tag` in the head: see [The root theme and switching](root-theme.md) |
| Classic server render (Vike, Next.js Pages Router, Vue) | `renderToString`, then `hydrateRoot`    | `extractPageStyles(cache, html, { themes })`: the CSS of that page only, in the head                |
| Server components (Next.js App Router)                  | Server components and client components | Each element renders its own `<style href precedence>`, in both builds                              |
| Client only                                             | Nothing on the server                   | The browser's cache inserts rules; `index.html` holds the static background                         |

### Which to use

| Framework                                    | Use                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vike (React), prerendered                    | `extractPageStyles(style.cache, html, { themes: [lightClass, darkClass] })` in the render hook; the style elements of the client build are carried by the markup and are not written again                                                                                                                                                |
| Next.js, Pages Router                        | The same, in `getInitialProps` of the custom document, from `initial.html`                                                                                                                                                                                                                                                                |
| Next.js, App Router                          | Nothing to call: server components and client components both render style elements. Render the provider in both builds: its theme goes to `:root`, or with `isRoot` it is the class you put on `<html>` with `themeClass`                                                                                                                |
| Vue                                          | `extractPageStyles(cache, html, { themes }).tag` after `renderToString`; Vue has no style elements of its own                                                                                                                                                                                                                             |
| React, no server components, extraction only | `createStyle(theme, { hasServerStyleElements: false })` and `extractPageStyles`: one style element in the head and no other                                                                                                                                                                                                               |
| A registry of your own, or CSS in chunks     | `@umber-style/cache` and `@umber-style/server/create-instance`: `<style data-umber>` elements keyed by a cache. The App Router registry (a `'use client'` providers file with `useServerInsertedHTML`) and a Vike page built with `extractCriticalToChunks` run in the fixtures. See [The cache and server packages](cache-and-server.md) |

The rules of a `Global` reach the page that renders it in each of these cases, and no other page: its markup says which sets it rendered (the style elements it carries, or the marker that `Global` leaves where it sends none), and the rules that `engine.insertGlobal` writes for the app reach every page. See [On a server](animations-and-global-styles.md#on-a-server). A `@keyframes` rule reaches it once, with the first class or global rule of the page that uses it: see the same section.

`createStyleTag(cache)` and `cache.extract()` keep working as they did: they return every rule the cache holds, whatever page inserted it. Use them for a static site that renders one page per cache, or a script. A process that renders more than one page must use `extractPageStyles`.

## Classic server render and hydration

Put the style in one module that the server and the browser both import:

```tsx
// style.tsx: imported by the server and by the browser
import { createStyle } from '@umber-style/react'

export const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

export const { styled, ThemeProvider, cache } = createStyle(theme, { prefix: 'umber' })

export const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[2],
}))

export const App = () => (
  <ThemeProvider theme={theme}>
    <Button>Save</Button>
  </ThemeProvider>
)
```

On the server, render, then ask the cache for the CSS of that page:

```tsx
import { renderToString } from 'react-dom/server'
import { extractPageStyles } from '@umber-style/core'
import { App, cache } from './style'

const html = renderToString(<App />)
// `themes`: the theme classes that no element of `html` has, such as the one on <html>.
const { tag } = extractPageStyles(cache, html, { themes: [] })

const page = [
  '<!doctype html><html><head>',
  tag,
  '</head><body><div id="root">',
  html,
  '</div><script src="/client.js"></script></body></html>',
].join('')
```

`extractPageStyles` returns `{ css, ids, options, tag }`. `tag` is one `<style>` element with the CSS of this page. The page below is shown with `hasServerStyleElements: false`; with the default, the same rules come as `<style data-precedence>` elements inside the markup (see "Client components" below), and `tag` holds only what the markup does not carry, such as the themes offered for switching. The provider is the outermost one, so it renders no element: its theme is declared on `:root`, and that rule is part of the CSS of the page. The page:

```text
<!doctype html>
<html>
  <head>
    <style data-style="umber" data-options="p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=">@layer umber-theme,umber-global,umber-components,umber-overrides;@layer umber-theme{:where(:root){--umber-palette-primary:#1b5fd1;--umber-palette-on-primary:#ffffff;--umber-space-2:8px;}}@layer umber-components{.umber-button-root-jiompv{background-color:var(--umber-palette-primary);color:var(--umber-palette-on-primary);padding:var(--umber-space-2);}}</style>
  </head>
  <body>
    <div id="root"><button class="umber-button-root-jiompv">Save</button></div>
    <script src="/client.js"></script>
  </body>
</html>
```

(The markup of the root and the CSS are asserted in `packages/react/src/providers.docs.ssr.test.tsx`; the markup is shown with line breaks, the CSS as the engine writes it.)

**The root theme of a page.** No element stands for the outermost provider, so `extractPageStyles` cannot find its theme in the markup. It takes the root theme that the cache declared last, the one of the render that just ran: render a page and extract its CSS before the next page renders, as above (`renderToString` is synchronous). A server that interleaves the renders of two pages (a stream for each, extracted at the end) and gives them different root themes should use the default `hasServerStyleElements`: the provider then sends its root theme as a style element in its own markup, keyed `umber-root-<hash>`, and `extractPageStyles` leaves it out.

In the browser, hydrate with the same module:

```tsx
// client.tsx
import { hydrateRoot } from 'react-dom/client'
import { App } from './style'

hydrateRoot(document.getElementById('root') as HTMLElement, <App />)
```

The cache of the browser reads the page when it is created: the rules of `style[data-style="umber"]` and of every `style[data-precedence="umber"]` (the elements React hoists). From their text it learns which classes have a rule, which theme classes are written with which variables, which `@property` rules are there, which layer order statement, and which variables the rules use. It inserts none of those again. Nothing is read from a list of ids: `data-ids` is no longer written.

The `:root` rule of the server is the one exception. The outermost provider declares its theme again in the browser, at hydration (in an insertion effect), and the cache then removes the root rules of the page and writes its own, with the same declarations: from then on a change of the theme rewrites the cache's rule, and no rule of the page stands in its way. Hydration does not change the markup or warn: `packages/react/src/themeProvider.hydrate.test.tsx` checks both builds of the page (one style element, and style elements in the markup), with `console.error` watched, the markup compared and the elements kept.

**How it notices rules that arrive later.** Streamed content and a client-side navigation in the App Router add style elements to the head after the cache was made. The cache watches the children of `<head>` with one `MutationObserver` (`childList` only, no subtree) and reads each matching element once as it arrives. A lazy re-scan on a class it does not know would cover the elements that a client component inserts, but not a navigation that renders only server components: no engine call follows, and the theme class that the browser made (the dark one) would lack the variables that the new rules use. The observer's callback runs only when the head changes. Reading 400 rules at start-up took about 1 ms in Chromium (`page.browser.test.ts`).

**Options must match.** The server stamps its options on its output (`data-options` on the style element of `extractPageStyles` and `createStyleTag`, a `<meta name="<prefix>-options">` from the providers of the React builds) and the browser compares them with its own: prefix, suffix, `hasLabels`, `hasLayers`, `hasPruning`, `hasBaseClass`, `hasScope`, `hasColorFallbacks` and a hash of the token options. One difference throws one error that names the options that differ and both values. A cache that is given to an engine does not know the token options of that engine, so its stamp has none.

**Order.** The CSS of a page is written in an order that depends on its classes only: the layer order, the `@property` rules, the rule of the root theme, the theme classes by name, then the classes by name, each props class right after its base class. It is not the order in which the cache first saw them, because that depends on which pages were rendered before: the same page gets the same CSS in every order, and from pages rendered at the same time.

**What the scan reads.** `extractPageStyles` reads the values of the `class` and `className` attributes in one linear pass. It skips the content of `script`, `style`, `textarea` and `title`, and comments other than the marker of a `Global`, and it never looks at a class name in another attribute. The markers name the sets of global rules that a `Global` rendered with no style element: the `content` of a `<meta name="<prefix>-global">` (React, with `hasServerStyleElements: false` or under a `CacheProvider`) and the words after the first of a comment `<!--<prefix>-global ...-->` (Vue). Only a set that the page carries or names, or that `engine.insertGlobal` wrote for the app, is in its CSS. A class name that only appears in text is not written. A theme class that no element of the markup has (the one on `<html>`, a theme offered for switching) goes in `themes`; it gets the same variables as the others, the ones the page uses. A style element that the markup carries (its `data-href`) is left out, with the variables that it uses still counted.

The same works on Vue with `createSSRApp` and `renderToString` from `vue/server-renderer`:

```ts
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { extractPageStyles } from '@umber-style/core'
import { createStyle } from '@umber-style/vue'

const theme = { palette: { primary: '#1b5fd1', onPrimary: '#ffffff' }, space: [0, 4, 8, 16] }
const { styled, ThemeProvider, cache } = createStyle(theme, { prefix: 'umber' })

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
}))

const app = createSSRApp({
  render: () => h(ThemeProvider, { theme }, () => h(Button, null, () => 'Save')),
})

const html = await renderToString(app)
const styleTag = extractPageStyles(cache, html).tag
```

Without a `document`, the cache keeps its rules in memory (`createMemorySheet`), and `extract()` returns them. With a `document` it writes to a real style element, and `extract()` still returns the same text. `extractPageStyles` does not change the cache, so one cache can serve many requests, at the same time.

## Server components

`@umber-style/react` has two builds. The package picks one by the `react-server` export condition, and so does the `umber-style/react` entry. In this repository the targets are TypeScript source, so each target is also the types of its build:

```json
"exports": {
  ".": {
    "react-server": "./src/index.server.ts",
    "default": "./src/index.ts"
  }
}
```

```json
"./react": {
  "react-server": { "types": "./src/shared.server.ts", "default": "./src/react.server.ts" },
  "types": "./src/shared.ts",
  "react-native": "./src/react-native.ts",
  "default": "./src/react.ts"
}
```

The second map is that of `umber-style`: under the `react-server` condition, the compiler and the bundler both take the server entry, and the compiler reads the server declarations. The first was traced with `tsc --traceResolution`: with `customConditions: ["react-server"]` it resolves to `index.server.ts`, without to `index.ts`. The published packages have the same shape, with the built files: the `publishConfig` of `@umber-style/react` maps the `react-server` condition to `dist/index.server.mjs` and `dist/index.server.cjs`, with their own declaration files (`index.server.d.mts`, `index.server.d.cts`), ahead of the client build, and that of `umber-style` maps `./react` under `react-server` to `dist/react.server.*` with the declarations of `shared.server`.

| Build                   | `useTheme()` gives                                 | Style elements                                                             | Hooks                                         |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| Client (the default)    | The theme of the nearest provider, of either build | In the browser none: the cache inserts rules. On a server, yes (see below) | `useTheme`, `useStyle`                        |
| Server (`react-server`) | The base theme, the same in every render           | `<style href precedence>` per element                                      | None: `useTheme` and `useStyle` are functions |

Both builds export `configure`, `getEngine`, `styled`, `StyleSheet`, `useStyle`, `useTheme`, `ThemeProvider`, `apply`, `themeClass`, `when`, `whenScheme`, `createStyle`, `at`, the arithmetic helpers and `alpha`, and the style types. A component that calls `useTheme()` is written once and runs unchanged as a server component and as a client component. The server build also has `readTheme`, another name of its `useTheme`, and has no `ThemeContext`, `ThemeScope` or `useThemeClass`: it has no context and no portal. The client build has no `readTheme`: a hook under a name that does not start with `use` would hide from the rules of hooks that it is one.

### `useTheme()`: one name, one rule

- **In a client component** it gives the real theme of the nearest provider, merged over the ones above, whichever build rendered them: a provider of a server component puts its theme into the same context as a provider of a client file (see [What crosses to the browser](#what-crosses-to-the-browser)).
- **In a server component** it gives the base theme: the theme given to `createStyle(theme)` or `configure({ theme })`. It is the same value in a full render and in a partial render (a client-side navigation renders only the segment that changed), whatever providers render in the request, and never the theme of a provider. With no base theme it returns an empty object, and warns once in development that the theme should be given to `createStyle` or `configure`.
- **A component that needs the nearest provider's values in a server tree** is marked `'use client'`, its code unchanged.

The same component as both (`packages/react/src/vitest.themeProbe.tsx`, which `useTheme.server.test.tsx` renders as a server component and `useTheme.test.tsx` as a client component):

```tsx
export function createThemeProbe(style: { useTheme(): typeof probeTheme }) {
  return function ThemeProbe({ id }: { id: string }) {
    const theme = style.useTheme()
    return <code data-id={id}>{`${theme.palette.surface} ${theme.breakpoints[0]}`}</code>
  }
}
```

Under `<ThemeProvider theme={{ ...probeTheme, breakpoints: ['900px'] }}>` and a nested `<ThemeProvider theme={{ palette: { surface: '#fff4d6' } }}>`, both of the server build, the server component prints `#ffffff 600px` (the base theme) and the client component prints `#fff4d6 900px` (the nearest provider's theme over the outer one's). The App Router fixture renders one component both ways on its brand page (`fixtures/next-app/app/(scheme)/theme-probe.tsx`).

A server component page:

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider, useTheme, themeClass } = createStyle(theme, { prefix: 'umber' })

// The class for <html>, which the layout puts there. Asking for it makes the rule that the root provider sends.
export const htmlClass = themeClass(theme)

const Hero = styled('section', { name: 'Hero' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[3],
}))

function FirstBreakpoint() {
  const { breakpoints } = useTheme()
  return <code>{breakpoints[0]}</code>
}

const Page = () => (
  <ThemeProvider theme={theme} isRoot>
    <Hero>
      <FirstBreakpoint />
    </Hero>
    <ThemeProvider theme={{ breakpoints: ['300px'] }}>
      <FirstBreakpoint />
    </ThemeProvider>
  </ThemeProvider>
)
```

Without `isRoot` the outermost provider declares its theme on `:root` instead, and sends that rule (see below); nothing goes on `<html>`.

What this renders, and what each part means:

- **The base theme.** A server component has no React context, and in a partial render the providers of the layouts above it do not render, so a server component cannot know the providers above it. `useTheme()` there returns the base theme: both `FirstBreakpoint` components read `600px`, not the nested provider's `300px`. A nested provider still changes the variables below it, through its theme class, and the theme that client components below it read.
- **The outermost provider.** The outermost provider is the one with no provider of its engine above it in the page, of either build. The server cannot see that: a client-side navigation renders only the segment that changed, so the provider of a layout above is mounted in the browser and does not render in that request. The server provider decides nothing. It renders `ProviderScope`, a client component of the package (an app never writes it), with the data of its theme as plain props. That component reads a context that each provider of either build fills for the ones below, and renders one of two outcomes. It renders on the server as any client component does, so the first HTML already holds the choice, and a page without script is right on a full load.
  - Outermost (nothing above): no element, and the rule that declares its theme on `:root`, a style element keyed `umber-root-<hash>` with every variable: the base theme, then the theme it was given, which wins where both declare a variable.
  - Nested: its wrapper, with the theme class of the theme it was given (only those variables: it cannot know the providers between it and the root), the markers and `umber-scope`, and their style elements.
- **A function theme** (`theme={(outer) => ...}`) of a provider in a server component is called with the base theme, in every render, outermost or nested: no server component can see the provider above it.
- **What is sent.** The theme the provider was given (after a function theme was called) goes once, as plain data: the values, not the declarations. With it go the token options of the engine (one object for the engine), the ids of both rules, the layer order, the `color-scheme`, the `@property` rules of its registered variables, and the style of the other classes of the wrapper. `ProviderScope` makes the declarations from the values with the tokens of the core, which name the variables from the token options alone: the text is the one the engine of the server writes for that theme, and the server's render of it and the browser's are the same text, so hydration does not mismatch and a page without script is right. It needs no engine of the client build. A theme that does not declare every variable of the base theme needs the base theme under it for a root rule: the first provider of a request sends the values of the base theme, as one object for each base theme, which a payload holds once however many providers name it. A provider that renders after another one in the same request is below or beside it, and sends none; if nothing is above it in the page (a second provider beside the outermost one), it renders its wrapper.
- **What a server component gets.** A function style gets the tokens as variables everywhere, and the real values (breakpoints, functions, your own settings) of the base theme. `useTheme()` returns the base theme, and an empty object if there is none. Read the real values of the nearest provider in a client component.
- **Style elements.** Each styled element and each provider renders `<style href precedence>` elements for its classes. React 19 moves them to the head and renders each `href` once. The `precedence` is the cache prefix. Each one starts with the layer order statement, so it is right on its own. For the page above the elements are `umber-theme-b2oxy9` (the theme class with every variable), `umber-hero-root-1gepzxb` (the Hero rule) and `umber-scope`.
- **`isRoot`.** A root provider renders no wrapper element and makes no theme class. It sends the `<style>` of the theme classes that `themeClass(theme, colorScheme)` already made for its `theme` (one for each colour scheme you asked with), so call `themeClass` for the class you put on an ancestor you control, in a component that renders before the provider (the layout that renders `<html>`), as in [The root theme and switching](root-theme.md). Without that call nothing is sent for the root theme.
- **`apply()` and sheets.** They make classes and rules, but nothing renders those rules: `apply(entry)` returns a class name and no `<style>` element comes with it. Use them through `styled` (a sheet entry in `style`), or add the rules yourself with `createStyleTag`.

The element of a theme class carries every variable of that theme (`cache.getFullRules`), because it is sent before the elements below it render, so a provider cannot know which variables they will use. Only the classic server render and the browser get the smaller, pruned classes: see [Tokens](tokens.md).

### Client components

A client component uses the client build, which reads the theme from a React context. A provider of a server component fills that context too: `ProviderScope`, its browser part, merges the theme it was given over the theme of the provider above it in the page (of either build), else over the base theme of the client bundle, and gives it to the context that every style of its prefix shares. So `useTheme()` and a function style of a client component below a provider of the server build read that provider's theme, on a full load and after a client-side navigation, and a provider of a client file below it merges over it and carries the class of its whole merged theme.

#### What crosses to the browser

Only plain data crosses from a server component to a client component: a function, a class instance and a symbol do not (the framework throws for a function). A provider of a server component sends the part of its theme that is plain data: strings, numbers, booleans, `null`, lists and plain objects, deeply. A member that is a function, a symbol or an object that is not plain (a class instance, a `Date`, a `Map`) is left out, and the provider warns once in development with the paths it left out. A theme's tokens are plain values, so no variable is affected; what can be left out are members under raw keys (helpers of `breakpoints`, `components` with style functions). A client component below reads such a member from the theme above: the provider above it in the page, else the base theme of the client bundle, which holds it when the same `createStyle(theme)` module is loaded in the browser. A raw key that a provider of a server component changed with a function or a class instance cannot reach a client component: there it keeps the value of the theme above.

A provider in a client file is the way to give client components a theme whose own functions they read:

```tsx
// providers.tsx
'use client'

import type { ReactNode } from 'react'
import { createStyle } from '@umber-style/react'
import { theme } from './theme'

const { styled, ThemeProvider, useTheme } = createStyle(theme, { prefix: 'umber' })

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme} isRoot>
      {children}
    </ThemeProvider>
  )
}

export const Pill = styled('span', { name: 'Pill' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  padding: theme.space[1],
}))

export function Breakpoint() {
  return <code>{useTheme().breakpoints[0]}</code>
}
```

The file imports the theme itself instead of receiving it as a prop. Use the same `prefix` and options as in the server file: classes are named from the hash of the rules and the prefix, so the two builds then make the same class name for the same style (a test compares the two). Every style of one prefix in the client build (the default style, each `createStyle`) shares one theme context, as they share the marks that say which provider is above.

#### The server render of a client component

A client component is also rendered on the server for the first HTML, by the client build. Where there is no `document`, that build renders the same `<style href precedence>` elements for its classes as the server components build does (one implementation, `styleElements.ts`), and its theme providers send the style of their theme classes, and the outermost one the style of its root theme. React moves them to the head and renders each `href` once, so a class that a server component and a client component both use is sent once. In the browser the client build keeps inserting into its sheet and renders none; the cache recognises the rules that arrived as style elements, so it does not insert them again. A theme class that only the browser made (the dark one) gets, from the rules of the page, every variable that the page uses.

React treats these elements as resources, not as part of the tree, so rendering them on the server and not in the browser raises no hydration warning. This was checked in two places: a test in the development build of React (`hydrateStyleElements.test.tsx`: `renderToString` with no `document`, then `hydrateRoot`, no `console.error`, the same DOM node kept), and the Next.js fixture, whose end-to-end run fails on any console error or hydration warning.

**One story for classic server renders.** The option `hasServerStyleElements` (default `true`) is what turns this on, because the first HTML of a client component in an App Router app needs it without any configuration. A classic server render with the default gets the style elements of the client build inside its markup, and `extractPageStyles` leaves them out of its own element (it reads their `data-href`), so no rule is sent twice. The element it writes then holds the offered themes and the stamp. Choose `hasServerStyleElements: false` if you want the whole page in one element in the head. Either way is correct; use the default for Next.js and Vike, the option for a page that must not have style elements in its markup. The `<meta name="<prefix>-options">` stamp is rendered by each provider build, so an App Router app has up to two of them with the same content: the browser reads the first.

### Types

`useTheme` is typed in both builds. A server component file needs the `react-server` custom condition in its TypeScript configuration to see `readTheme`, and to have `ThemeContext`, `ThemeScope` and `useThemeClass` reported as missing:

```json
{
  "compilerOptions": {
    "customConditions": ["react-server"]
  }
}
```

The condition applies to the whole program, so a project that also type-checks client components uses the condition only for the server files: a second `tsconfig` that extends the first and includes the server component files. Without the condition the types are those of the client build: `readTheme` is reported as missing, and `ThemeContext` is typed although it does not exist there. `@umber-style/react` and `umber-style/react` both follow it (the exports map of each names its own types under `react-server`): under it, `umber-style/react` types `useTheme` and `readTheme`. `readTheme` is typed in that entry only under the condition, because the React Native binding has no `readTheme` and no server build: shared code calls `useTheme`.

## Content security policy

The engine renders no `style` attribute (see [No inline styles](no-inline-styles.md)), but it writes CSS into `<style>` elements, and a policy whose `style-src` has no `'unsafe-inline'` blocks a style element unless it carries the policy's nonce. Give the nonce once, and every style element the engine makes carries it. It is never written into a rule, a class name or the stamp of the options, so the class names and the hydration are the same with it or without, and in a tag it is escaped (`&`, `"`, `<`, `>`).

| Where the element is made                                                              | Where its nonce comes from                                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The style element of the cache in the browser (`createDomSheet`, both ways of writing) | `createStyle(theme, { nonce })`, `configure({ nonce })`, `createCache({ nonce })`, `createDomSheet(key, container, { nonce })` |
| `createStyleTag(cache)` and the `tag` of `extractPageStyles(cache, html)`              | `options.nonce` of the call, else the cache's                                                                                  |
| The `<style data-umber>` tags of `@umber-style/server/create-instance`                 | The cache's: `createCache({ key, nonce })` of `@umber-style/cache`                                                             |
| The `<style href precedence>` elements of React, in both builds                        | The cache's, as their `nonce` prop                                                                                             |
| Vue on a server                                                                        | Vue makes no style element: the `tag` of `extractPageStyles`                                                                   |

In the browser the element is made when the cache writes its first rule, never when the cache or the style is made, so a cache that writes nothing adds no element; the nonce is set before the element goes into the document. From `packages/react/src/nonce.test.tsx`:

```tsx
const { styled } = createStyle(
  { palette: { primary: '#0000ff' } },
  {
    prefix: 'nb',
    nonce: 'n0nce',
  }
)
const Box = styled('div', { name: 'Box' })(({ theme }) => ({ color: theme.palette.primary }))
render(<Box />)
document.head.querySelector('style[data-style="nb"]')?.getAttribute('nonce') // 'n0nce'
```

The page has to give the browser its nonce. The Vue fixture puts it on a `<meta property="csp-nonce" nonce="...">` and reads it where it makes its style (`fixtures/vue-ssr/src/style.ts`):

```ts
const readPageNonce = (): string | undefined =>
  typeof document === 'undefined'
    ? undefined
    : document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce

export const style = createStyle(lightTheme, { prefix: 'umber', nonce: readPageNonce() })
```

A server that renders many requests with one cache gives the nonce of each request to the call that writes its tag. From `packages/core/src/cache.nonce.test.ts`:

```ts
const shared = createCache({ hasLayers: false, prefix: 'u', sheet: createMemorySheet() })
const name = shared.css({ color: 'red' })
const page = extractPageStyles(shared, `<p class="${name}"></p>`, { nonce: 'request1' })
page.tag // `<style data-style="u" data-options="${shared.fingerprint}" nonce="request1">.${name}{color:red;}</style>`
page.css // `.${name}{color:red;}`
```

The Vue fixture does this in its render, `extractPageStyles(style.cache, html, { themes: [lightClass, darkClass], nonce })`, with a new nonce for each request, sent with `Content-Security-Policy: style-src 'nonce-<n>'; script-src 'self' 'nonce-<n>'` (`fixtures/vue-ssr/server.mjs`). A cache made for each request (a registry, `createInstance`) holds the nonce itself: `createCache({ key: 'app', nonce })`, and its tags are `<style data-umber="app-global ..." nonce="...">` (`packages/server/src/createInstance.test.ts`).

React merges the `<style href precedence>` elements of one precedence into one element, and writes on it the style nonce of its own render, not the prop: give the render the same nonce. React keeps the rules of an element only when its `nonce` prop is that nonce, and in the browser it sets the prop on the element it adds after a client-side navigation. From `packages/react/src/nonce.ssr.test.tsx`:

```tsx
const { styled, Global, ThemeProvider, keyframes } = createStyle(theme, {
  prefix: 'ns',
  nonce: 'n0nce',
})
const stream = await renderToReadableStream(page, { nonce: { script: 'n0nce', style: 'n0nce' } })
// <style nonce="n0nce" data-precedence="ns" data-href="ns-root-... ns-global-... fade-... ns-box-root-...">
```

Rendered with no style nonce, React sends the element with no `nonce` and logs:

```text
React encountered a style tag with `precedence` "%s" and `nonce` "%s". When React manages style rules using `precedence` it will only include a nonce attributes if you also provide the same style nonce value as a render option.
```

In the App Router a registry with a nonce for each request is verified end to end, on the production build and on the development server: the proxy that makes the nonce and the policy, the layout that reads it from the request and gives it to the providers file as a prop, the cache and the registry's element that take it, and the style of the components that reads the page's nonce in the browser. See [With a nonce, under a strict policy](cache-and-server.md#with-a-nonce-under-a-strict-policy).

The server components build puts the cache's nonce on every style element it renders: a styled class, its animation, a `Global`, and both outcomes of a provider (`packages/react/src/nonce.server.test.tsx`, `ProviderScope.test.tsx`).

The end-to-end suite loads a page of the Vue fixture under that policy (`e2e/tests/vue-ssr.csp.spec.ts`): its computed styles are those of the page with no policy, it hydrates with no console error, every style element holds the request's nonce, and after a client-side navigation to a page with classes the first HTML did not have, its styles are those of that page loaded with no policy and the browser reports no violation. With the nonce left out of the server's tag, the same test fails with 284 differences and `Applying inline style violates the following Content Security Policy directive`.

## Limits

- `extractPageStyles` takes the root theme that the cache declared last. Two pages rendered at the same time with different root themes need the style elements of the React builds, which carry their root theme, or a render and an extraction that do not interleave.
- Vue has no style elements: its server render is extracted with `extractPageStyles`, so the same holds for it.

- `useTheme()` of a server component never gives the theme of a provider, by design: in a partial render the providers above it do not render. Read the nearest provider's values in a client component.
- With no base theme (the default style without `configure({ theme })`) the server build has none to give: a provider never makes its theme the base theme there, so what a request reads does not depend on which request came first. A function style, a function sheet and `Global` then read the shape of the theme of the first provider that renders in the request (tokens are references either way, and the real values are that theme's); in a request where no provider renders before them (a partial render of a page with no provider) they get an empty theme, and one that reads a token throws a `TypeError`. `themeClass` and `when` still make their theme the base theme when there is none, as the engine does in every build: give the base theme to `createStyle` or `configure`.
- A provider of a server component sends the plain data of its theme only (see [What crosses to the browser](#what-crosses-to-the-browser)). Members that are not enumerable, and members of a list other than its items, are not read.
- A payload in which the first provider that renders has a theme that does not declare every variable of the base theme (the page provider of a client-side navigation) holds the values of the base theme once: about 0.3 kB with the fixture's theme of 22 variables, about 10 kB with a theme of 500 variables, before compression. A full render whose outermost provider has the whole theme sends none.
- The first HTML holds the theme of each provider of the server build twice: as values in the payload of server components that the framework puts in the page, and as declarations in the style element of the outcome chosen.
- The server components build runs in the Next.js App Router fixture (Turbopack, production build) and the end-to-end suite checks it. Other frameworks with server components were not run.
- `React.cache` keeps nothing outside a render: called elsewhere it makes a new slot each time, so each provider called there is the first of its request and sends the stamp.
- The rules are read from the text of the style elements. A class name that a hand-written rule of yours puts after the first class of a selector marks that class as present; an engine class used only as a descendant of another is the one case that could make the cache skip a rule it needs. The engine writes no such rule.
- A style element that is added to the body, or whose text is added after the element is, is not read by the observer; React's elements are complete when they are inserted into the head.
- `hasServerStyleElements` does not know the framework: it is on wherever the client build runs with no `document`.
- The browser reads the page when its cache is created. The style elements must be in the document before the module that creates the cache runs; those that come later are read by the observer.
- The nonce of the engine's own cache is fixed when the engine is made. The style elements of React's builds read it from that cache, so a server that renders every request with one engine (a module-level `createStyle`, the server components build) sends the same nonce in each. A nonce for each request needs a cache for each request (under a `CacheProvider`, which renders no style element, with a registry that writes its own), or the `nonce` option of `extractPageStyles` for a classic render. The server components build has no nonce for each request.
- React's own render writes the nonce of the merged `<style href precedence>` element (its `nonce: { style }` option). A framework that gives React no style nonce (or a string, which React takes as the script nonce only) sends that element with no nonce; whether a framework passes one is the framework's.
- An element that the browser's cache finds instead of making one (written with `insertRule` it uses the server's element) keeps the nonce it has: the cache neither sets nor checks it. Rules added with `insertRule` are not checked by a style policy.
- The end-to-end tests of a policy run on the Vue fixture (production build) and on the registry of the App Router fixture (production build and development server, `e2e/tests/next-app.csp.spec.ts`, `e2e/dev-tests/csp.spec.ts`), in Chromium only. The Vue fixture has no development server in the development tier; a Vite development server can send a strict policy (its `html.cspNonce` option), which was not run. The `<style href precedence>` elements of React were not on the policy pages: they are tested at the unit tier (what React's server render writes, in Node, and what the client build adds, in jsdom), and a page of server components with styled components under a policy was not run in a browser.
- Under a strict policy the development server of Next.js reports violations of its own: its development tools write style elements with no nonce. The suite tells them apart by their script; they are not the engine's.
- An element that a cache finds instead of making one keeps the nonce it has (above). A style made at the top of a module, with no nonce, makes its element in the browser when it writes its first rule there (a `themeClass` at the top of a module does), and a cache of the same key with a nonce then writes into that element: give that style the page's nonce in the browser too (`nonce: readPageNonce()`, as the Vue fixture and the App Router fixture do). A style that writes nothing into its own cache in the browser, because every component renders under a `CacheProvider`, makes no element and needs no nonce.
- On a server, global rules are never removed from the cache; a page extracted from it carries the sets it rendered and those written for the app. See the Limits of [Animations and global styles](animations-and-global-styles.md).
- The registry of `@umber-style/cache` runs in the App Router fixture and the chunk functions of `@umber-style/server` on a page of the Vike fixture. Under a registry the styled components of client components go through it; those of server components still send their own style elements, and a page that does both was not run. See the Limits of [The cache and server packages](cache-and-server.md).
