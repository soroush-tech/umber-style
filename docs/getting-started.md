# Getting started

After this page you can install a package and render a themed button with React, Vue, React Native or plain JavaScript. The four examples are the same idea: one theme object, one styled button, one provider.

## Install

Nothing is published yet. Once it is, install the package for your platform:

```sh
# Not yet published. Once it is:
pnpm add @umber-style/react        # React on the web
pnpm add @umber-style/vue          # Vue
pnpm add @umber-style/react-native # React Native
pnpm add @umber-style/core         # plain JavaScript, no framework
pnpm add umber-style               # all of them, as subpaths
```

`umber-style` re-exports the core at its root and each binding as `umber-style/react`, `umber-style/react-native` and `umber-style/vue`. The pages use the scoped packages for web code. `umber-style/react` is special: it is the entry for one source that runs on the web and on React Native, and its types are the intersection of both platforms. See [Typed styles](typed-styles.md) and [Style sheets and the style prop](style-sheets.md).

The bindings declare these peer dependencies: `react` `^19.2.8`, `vue` `^3.5.0`, and `react-native` `>=0.76.0` (optional, because only the React Native binding uses it).

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
<div class="umber-theme-b2oxy9 umber-boundary umber-scope">
  <button class="umber-button-root-15gvy7r">Save</button>
</div>
```

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

The examples use render functions. Single-file components with a template use the same components, but no test in the repository compiles a template, so that form is not verified.

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

- Nothing here has run on npm: the install lines are what they will be.
- The React Native example was compiled against the real `react-native` types and run against a stand-in for the platform in a test. The binding has never been run in a real app.
- The Vue template form is not verified, as said above.
