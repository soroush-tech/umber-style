# Server rendering

After this page you can render a themed page on the server, send its CSS with it, hydrate it in the browser without repeating a rule, and use the server components build of the React binding.

There are three cases, and they use different parts of the engine:

| Case                  | What renders                         | How the CSS reaches the page                                                           |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Static page           | `renderToStaticMarkup`, no client JS | `createStyleTag(cache)` in the head: see [The root theme and switching](root-theme.md) |
| Classic server render | `renderToString`, then `hydrateRoot` | `createStyleTag(cache)` in the head, and the browser skips what it holds               |
| Server components     | A server component tree              | Each element renders its own `<style href precedence>`                                 |

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

On the server, render, then ask the cache for what it holds:

```tsx
import { renderToString } from 'react-dom/server'
import { createStyleTag } from '@umber-style/core'
import { App, cache } from './style'

const html = renderToString(<App />)

const page = [
  '<!doctype html><html><head>',
  createStyleTag(cache),
  '</head><body><div id="root">',
  html,
  '</div><script src="/client.js"></script></body></html>',
].join('')
```

`createStyleTag(cache)` is one `<style>` element with every rule inserted so far and the ids that the cache already holds. The page:

```html
<!doctype html>
<html>
  <head>
    <style
      data-style="umber"
      data-ids="umber-theme-b2oxy9 umber-scope umber-layers umber-button-root-jiompv --umber-palette-primary --umber-palette-on-primary --umber-space-2"
    >
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

The cache of the browser finds `style[data-style="umber"]` when it is created, reads `data-ids`, and does not insert a rule that the server sent. Variables count too: `data-ids` lists the used variables, and a theme class that the server sent is taken to hold those and no more, so a variable that only the browser needs is appended once and nothing is repeated or lost.

This was run in jsdom with the output above: the style element had four rules before hydration and four after, there was still one style element, and nothing was logged as an error.

The same works on Vue with `createSSRApp` and `renderToString` from `vue/server-renderer`:

```ts
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createStyleTag } from '@umber-style/core'
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
const styleTag = createStyleTag(cache)
```

Without a `document`, the cache keeps its rules in memory (`createMemorySheet`), and `extract()` returns them. With a `document` it writes to a real style element, and `extract()` still returns the same text.

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

| Build                   | Theme reaches a component by      | Style elements                        | Hooks                                     |
| ----------------------- | --------------------------------- | ------------------------------------- | ----------------------------------------- |
| Client (the default)    | A React context                   | None: the cache inserts rules         | `useTheme`, `useStyle`                    |
| Server (`react-server`) | A slot that lives for one request | `<style href precedence>` per element | None: `readTheme()` instead of `useTheme` |

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

The file imports the theme itself instead of receiving it as a prop. Use the same `prefix` as in the server file: classes are named from the hash of the rules and the prefix, so the two builds then make the same class name for the same style (a test compares the two).

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

- **The server components build was never run in a real bundler.** The tests resolve the `react-server` condition and render a tree with a small helper (`packages/react/src/vitest.resolveTree.ts`), which calls components one after another. Whether a framework's server renderer picks the condition, moves the `<style href precedence>` elements to the head, and orders out-of-order rendering as assumed has not been checked.
- `React.cache` keeps nothing outside a render: called elsewhere it makes a new slot each time, so `readTheme()` there returns the base theme.
- The server pass of a client component (the server-side render of a `'use client'` file) uses the client build. That build writes its rules to an in-memory sheet and nothing sends them: the client's rules arrive only when its JavaScript runs. This is reasoned from the code and not observed.
- A classic server render keeps its cache for as long as the module lives. `createStyleTag(cache)` returns every rule inserted since then, for every page rendered so far, so the cache of a long-lived server process grows with the distinct styles it has seen and each page repeats the earlier ones. Making a new `createStyle` per request avoids this; that costs creating your styled components per request, and was not measured.
- The browser reads `data-ids` when its cache is created. The style element must be in the document before the module that creates the cache runs.
- There is no nonce option for the style elements: see [No inline styles](no-inline-styles.md).
