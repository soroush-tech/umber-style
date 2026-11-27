# Getting started

After this page you can install a package and render a themed button with React, Vue, React Native or plain JavaScript. The four examples are the same idea: one theme object, one styled button, one provider.

## Install

Install the package for your platform:

```sh
pnpm add @umber-style/react        # React on the web
pnpm add @umber-style/vue          # Vue
pnpm add @umber-style/react-native # React Native
pnpm add @umber-style/core         # plain JavaScript, no framework
pnpm add umber-style               # all of them, as subpaths
```

Every package has a stable release on the `latest` tag of npm, which the lines above install. Prereleases go to the `alpha` and `rc` tags, for trying a change before it reaches `latest`: `pnpm add umber-style@alpha`. See [Releasing](releasing.md).

`umber-style` re-exports the core at its root and each binding as `umber-style/react`, `umber-style/react-native` and `umber-style/vue`. The pages use the scoped packages for web code. `umber-style/react` is special: it is the entry for one source that runs on the web and on React Native, and its types are the intersection of both platforms. See [Typed styles](typed-styles.md) and [Style sheets and the style prop](style-sheets.md).

The bindings declare these peer dependencies: `react` `^19.0.0`, `vue` `^3.5.0`, and `react-native` `>=0.76.0` (optional, because only the React Native binding uses it). The tests run on each React 19 minor, 19.0 to 19.3. A strict nonce policy on a page rendered on a server needs React 19.2 or later (see [Content security policy](server-rendering.md#content-security-policy)). An app on the Next.js App Router runs the React that Next.js bundles, not the one it installs.

On the Next.js App Router, add the registry of `@umber-style/react/next` once, around the page, in the root layout: `import { StyleRegistry } from '@umber-style/react/next'`, then `<body><StyleRegistry>{children}</StyleRegistry></body>`. It writes the styles of each request into the stream, server components and client components, with the request's nonce under a content security policy. `next` is an optional peer dependency of `@umber-style/react` (`^16.3.0`), read by that entry only; the umbrella gives the same entry as `umber-style/react/next`. See [A registry for the Next.js App Router](cache-and-server.md#a-registry-for-the-nextjs-app-router).

## React

```tsx
import { createRoot } from 'react-dom/client'
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

const { styled, ThemeProvider } = createStyle(theme, { prefix: 'umber' })

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[2],
  '&:hover': { opacity: 0.8 },
}))

const App = () => (
  <ThemeProvider theme={theme}>
    <Button>Save</Button>
  </ThemeProvider>
)

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
```

The page ends up as:

```html
<button class="umber-button-root-15gvy7r">Save</button>
```

The provider renders no element: the variables of its theme are declared on `:root`, in the style element of the engine. A provider nested inside another renders a wrapper with its own theme: see [Themes](themes.md).

The hashes in these pages come from real output; yours will differ if your theme or styles differ.

## Vue

```ts
import { createApp, h } from 'vue'
import { createStyle } from '@umber-style/vue'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

const { styled, ThemeProvider } = createStyle(theme, { prefix: 'umber' })

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
  padding: theme.space[2],
  '&:hover': { opacity: 0.8 },
}))

createApp({
  render: () => h(ThemeProvider, { theme }, () => h(Button, null, () => 'Save')),
}).mount('#app')
```

The examples use render functions. A template of a single-file component uses the same components: one is compiled with the compiler of single-file components in a test of the Vue binding, and gives the class names of the same tree written with `h` (see [Vue](vue.md#limits)).

## React Native

```tsx
import { Pressable, Text } from 'react-native'
import { createStyle } from '@umber-style/react-native'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
}

const { styled, ThemeProvider } = createStyle(theme)

const Button = styled(Pressable)(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  padding: theme.space[2],
  borderRadius: 8,
}))

const Label = styled(Text)(({ theme }) => ({ color: theme.palette.onPrimary }))

const App = () => (
  <ThemeProvider theme={theme}>
    <Button>
      <Label>Save</Label>
    </Button>
  </ThemeProvider>
)
```

On React Native `styled` needs a component, not a tag name, and a style function receives the real values (`padding: 8`), not variable references. There is no `:hover`, no media query and no class: a style is an object of the platform's own keys. See [React Native](react-native.md).

## Plain JavaScript

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

`button` is `umber-sarboa`. `light` is `umber-theme-jg3s2a umber-boundary umber-scheme-light`: put it on an element and every `var(--umber-...)` below it has a value. Put `night` there instead and the same `button` class turns dark.

## Next

- [How it works](how-it-works.md) explains what just happened.
- [Writing styles](writing-styles.md) covers `styled` in full.
- [Themes](themes.md) covers nesting and typing your theme.

## Limits

- The install lines install the release on `latest`; the examples here are checked against the code of this repository, which can be ahead of that release (see the release notes of each package).
- The React Native example was compiled against the real `react-native` types and run against a stand-in for the platform in a test. The binding has never been run in a real app.
- The Vue template form is compiled and rendered on a server in a test; it is not run in a browser in this repository.
