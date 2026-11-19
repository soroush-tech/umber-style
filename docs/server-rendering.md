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

| Framework                                    | Use                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vike (React), prerendered                    | `extractPageStyles(style.cache, html, { themes: [lightClass, darkClass] })` in the render hook; the style elements of the client build are carried by the markup and are not written again  |
| Next.js, Pages Router                        | The same, in `getInitialProps` of the custom document, from `initial.html`                                                                                                                  |
| Next.js, App Router                          | Nothing to call: server components and client components both render style elements. Put the classes of the themes on `<html>` with `themeClass`, and render a root provider in both builds |
| Vue                                          | `extractPageStyles(cache, html, { themes }).tag` after `renderToString`; Vue has no style elements of its own                                                                               |
| React, no server components, extraction only | `createStyle(theme, { hasServerStyleElements: false })` and `extractPageStyles`: one style element in the head and no other                                                                 |

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

`extractPageStyles` returns `{ css, ids, options, tag }`. `tag` is one `<style>` element with the CSS of this page. The page below is shown with `hasServerStyleElements: false`; with the default, the same rules come as `<style data-precedence>` elements inside the markup (see "Client components" below), and `tag` holds only what the markup does not carry, such as the themes offered for switching. The page:

```html
<!doctype html>
<html>
  <head>
    <style data-style="umber" data-options="p=umber;x=;l=1;y=1;r=1;b=1;s=1;f=1;t=">
      @layer umber-theme, umber-global, umber-components, umber-overrides;
      @layer umber-theme {
        .umber-scope {
          display: contents;
        }
      }
      @layer umber-components {
        .umber-button-root-jiompv {
          background-color: var(--umber-palette-primary);
          color: var(--umber-palette-on-primary);
          padding: var(--umber-space-2);
        }
      }
      @layer umber-theme {
        .umber-theme-b2oxy9 {
          --umber-palette-primary: #1b5fd1;
          --umber-palette-on-primary: #ffffff;
          --umber-space-2: 8px;
        }
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="umber-theme-b2oxy9 umber-boundary umber-scope">
        <button class="umber-button-root-jiompv">Save</button>
      </div>
    </div>
    <script src="/client.js"></script>
  </body>
</html>
```

In the browser, hydrate with the same module:

```tsx
// client.tsx
import { hydrateRoot } from 'react-dom/client'
import { App } from './style'

hydrateRoot(document.getElementById('root') as HTMLElement, <App />)
```

The cache of the browser reads the page when it is created: the rules of `style[data-style="umber"]` and of every `style[data-precedence="umber"]` (the elements React hoists). From their text it learns which classes have a rule, which theme classes are written with which variables, which `@property` rules are there, which layer order statement, and which variables the rules use. It inserts none of those again. Nothing is read from a list of ids: `data-ids` is no longer written.

**How it notices rules that arrive later.** Streamed content and a client-side navigation in the App Router add style elements to the head after the cache was made. The cache watches the children of `<head>` with one `MutationObserver` (`childList` only, no subtree) and reads each matching element once as it arrives. A lazy re-scan on a class it does not know would cover the elements that a client component inserts, but not a navigation that renders only server components: no engine call follows, and the theme class that the browser made (the dark one) would lack the variables that the new rules use. The observer's callback runs only when the head changes. Reading 400 rules at start-up took about 1 ms in Chromium (`page.browser.test.ts`).

**Options must match.** The server stamps its options on its output (`data-options` on the style element of `extractPageStyles` and `createStyleTag`, a `<meta name="<prefix>-options">` from the providers of the React builds) and the browser compares them with its own: prefix, suffix, `hasLabels`, `hasLayers`, `hasPruning`, `hasBaseClass`, `hasScope`, `hasColorFallbacks` and a hash of the token options. One difference throws one error that names the options that differ and both values. A cache that is given to an engine does not know the token options of that engine, so its stamp has none.

**Order.** The CSS of a page is written in an order that depends on its classes only: the layer order, the `@property` rules, the theme classes by name, then the classes by name, each props class right after its base class. It is not the order in which the cache first saw them, because that depends on which pages were rendered before: the same page gets the same CSS in every order, and from pages rendered at the same time.

**What the scan reads.** `extractPageStyles` reads the values of the `class` and `className` attributes in one linear pass. It skips comments and the content of `script`, `style`, `textarea` and `title`, and it never looks at a class name in another attribute. A class name that only appears in text is not written. A theme class that no element of the markup has (the one on `<html>`, a theme offered for switching) goes in `themes`; it gets the same variables as the others, the ones the page uses. A style element that the markup carries (its `data-href`) is left out, with the variables that it uses still counted.

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

The second map is that of `umber-style`: under the `react-server` condition, the compiler and the bundler both take the server entry, and the compiler reads the server declarations. The first was traced with `tsc --traceResolution`: with `customConditions: ["react-server"]` it resolves to `index.server.ts`, without to `index.ts`. A published package needs the same shape, with a `types` file for each build, in its `publishConfig`; none is published yet.

| Build                   | Theme reaches a component by      | Style elements                                                             | Hooks                                     |
| ----------------------- | --------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| Client (the default)    | A React context                   | In the browser none: the cache inserts rules. On a server, yes (see below) | `useTheme`, `useStyle`                    |
| Server (`react-server`) | A slot that lives for one request | `<style href precedence>` per element                                      | None: `readTheme()` instead of `useTheme` |

Both builds export `configure`, `getEngine`, `styled`, `StyleSheet`, `useStyle`, `ThemeProvider`, `apply`, `themeClass`, `when`, `whenScheme`, `createStyle`, `at`, the arithmetic helpers and `alpha`, and the style types. The server build has `readTheme` and no `useTheme`.

A server component page:

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider, readTheme, themeClass } = createStyle(theme, { prefix: 'umber' })

// The class for <html>, which the layout puts there. Asking for it makes the rule that the root provider sends.
export const htmlClass = themeClass(theme)

const Hero = styled('section', { name: 'Hero' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[3],
}))

function FirstBreakpoint() {
  const { breakpoints } = readTheme()
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

What this renders, and what each part means:

- **The request-scoped root theme.** A server component has no React context. The server `ThemeProvider` writes its theme into a slot that `React.cache` keeps for the length of one request. Only the first provider that renders in a request writes it: server components can render out of order, and a nested provider must not change what the root gave. Both `FirstBreakpoint` components read `600px`, the root's breakpoint, because the nested provider's `300px` is not written. A nested provider still changes the variables below it, through its theme class.
- **What a server component gets.** A function style gets the tokens as variables everywhere, and the real values (breakpoints, functions, your own settings) of the root theme. `readTheme()` returns the real values of the root theme merged over the base theme; with no provider it returns the base theme, and it throws if there is none.
- **Style elements.** Each styled element and each provider renders `<style href precedence>` elements for its classes. React 19 moves them to the head and renders each `href` once. The `precedence` is the cache prefix. Each one starts with the layer order statement, so it is right on its own. For the page above the elements are `umber-theme-b2oxy9` (the theme class with every variable), `umber-hero-root-1gepzxb` (the Hero rule) and `umber-scope`.
- **`isRoot`.** A root provider renders no wrapper element and makes no theme class. It sends the `<style>` of the theme classes that `themeClass(theme, colorScheme)` already made for its `theme` (one for each colour scheme you asked with), so call `themeClass` for the class you put on an ancestor you control, in a component that renders before the provider (the layout that renders `<html>`), as in [The root theme and switching](root-theme.md). Without that call nothing is sent for the root theme.
- **`apply()` and sheets.** They make classes and rules, but nothing renders those rules: `apply(entry)` returns a class name and no `<style>` element comes with it. Use them through `styled` (a sheet entry in `style`), or add the rules yourself with `createStyleTag`.

The element of a theme class carries every variable of that theme (`cache.getFullRules`), because it is sent before the elements below it render, so a provider cannot know which variables they will use. Only the classic server render and the browser get the smaller, pruned classes: see [Tokens](tokens.md).

### Client components

A client component uses the client build, which reads the theme from a React context. That context is not filled by a server component's provider: a theme holds functions, which cannot cross to a client component as a prop. A client component that calls `useTheme()` or uses `styled` with a function style needs a `ThemeProvider` that is imported in a client file:

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

The file imports the theme itself instead of receiving it as a prop. Use the same `prefix` and options as in the server file: classes are named from the hash of the rules and the prefix, so the two builds then make the same class name for the same style (a test compares the two).

#### The server render of a client component

A client component is also rendered on the server for the first HTML, by the client build. Where there is no `document`, that build renders the same `<style href precedence>` elements for its classes as the server components build does (one implementation, `styleElements.ts`), and its theme providers send the style of their theme classes. React moves them to the head and renders each `href` once, so a class that a server component and a client component both use is sent once. In the browser the client build keeps inserting into its sheet and renders none; the cache recognises the rules that arrived as style elements, so it does not insert them again. A theme class that only the browser made (the dark one) gets, from the rules of the page, every variable that the page uses.

React treats these elements as resources, not as part of the tree, so rendering them on the server and not in the browser raises no hydration warning. This was checked in two places: a test in the development build of React (`hydrateStyleElements.test.tsx`: `renderToString` with no `document`, then `hydrateRoot`, no `console.error`, the same DOM node kept), and the Next.js fixture, whose end-to-end run fails on any console error or hydration warning.

**One story for classic server renders.** The option `hasServerStyleElements` (default `true`) is what turns this on, because the first HTML of a client component in an App Router app needs it without any configuration. A classic server render with the default gets the style elements of the client build inside its markup, and `extractPageStyles` leaves them out of its own element (it reads their `data-href`), so no rule is sent twice. The element it writes then holds the offered themes and the stamp. Choose `hasServerStyleElements: false` if you want the whole page in one element in the head. Either way is correct; use the default for Next.js and Vike, the option for a page that must not have style elements in its markup. The `<meta name="<prefix>-options">` stamp is rendered by each provider build, so an App Router app has up to two of them with the same content: the browser reads the first.

### Types

A server component file needs the `react-server` custom condition in its TypeScript configuration to see `readTheme`:

```json
{
  "compilerOptions": {
    "customConditions": ["react-server"]
  }
}
```

The condition applies to the whole program, so a project that also type-checks client components uses the condition only for the server files: a second `tsconfig` that extends the first and includes the server component files. Without the condition the types are those of the client build: `readTheme` is reported as missing and `useTheme` is typed although it does not exist there. `@umber-style/react` and `umber-style/react` both follow it (the exports map of each names its own types under `react-server`): under it, `umber-style/react` types `readTheme` and has no `useTheme`. `readTheme` is typed in that entry only under the condition, because the React Native binding has no `readTheme` and no server build: shared code that has to run on React Native does not call it.

## Limits

- The server components build runs in the Next.js App Router fixture (Turbopack, production build) and the end-to-end suite checks it. Other frameworks with server components were not run.
- `React.cache` keeps nothing outside a render: called elsewhere it makes a new slot each time, so `readTheme()` there returns the base theme.
- The rules are read from the text of the style elements. A class name that a hand-written rule of yours puts after the first class of a selector marks that class as present; an engine class used only as a descendant of another is the one case that could make the cache skip a rule it needs. The engine writes no such rule.
- A style element that is added to the body, or whose text is added after the element is, is not read by the observer; React's elements are complete when they are inserted into the head.
- `hasServerStyleElements` does not know the framework: it is on wherever the client build runs with no `document`.
- The browser reads the page when its cache is created. The style elements must be in the document before the module that creates the cache runs; those that come later are read by the observer.
- There is no nonce option for the style elements: see [No inline styles](no-inline-styles.md).
