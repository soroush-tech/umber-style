# Style sheets and the style prop

After this page you can keep named styles in a sheet, apply them to styled components and plain elements, override a component from outside, and write one component source that runs on the web and on React Native.

## `StyleSheet.create` and `useStyle`

A sheet is a set of named styles. Make it once, at module level, and read it in a component with `useStyle`:

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff', hover: '#154a9f' },
  space: [0, 4, 8, 16],
}

const { styled, StyleSheet, useStyle, apply, ThemeProvider } = createStyle(theme, {
  prefix: 'umber',
})

const sheet = StyleSheet.create((theme) => ({
  box: { padding: theme.space[2] },
  active: { backgroundColor: theme.palette.primary },
}))

const Card = styled('div', { name: 'Card' })({ color: 'inherit' })

function Box({ isActive }: { isActive?: boolean }) {
  const styles = useStyle(sheet)
  return (
    <Card style={[styles.box, isActive && styles.active, { opacity: 0.9 }]}>
      <p {...apply(styles.box)}>a plain element</p>
    </Card>
  )
}
```

`StyleSheet.create` takes an object of styles, or a function of the theme that returns one. A function receives the theme as references, like a function style, and is resolved against the nearest provider: a theme that changes a breakpoint gets its own entries. An object is resolved once.

`useStyle(sheet)` returns one entry for each name. On the web an entry is a frozen object that holds a class name. It prints as that class name (`String(entry)` and `entry.className` agree). On React Native an entry is a style object. Treat an entry as opaque: pass it on, do not read it, so that your code runs on both platforms.

`useStyle` is a hook on React (call it in a component) and must run in `setup` on Vue. `StyleSheet.create` is not a hook.

## The `style` prop of a styled component

A component made by `styled()` takes `style`, and this is the engine's own API, not an inline style. It takes sheet entries and style objects, in arrays, with `false`, `null` and `undefined` dropped. All of it is merged, in order, into one class, and **no `style` attribute is rendered**. A string is an error, because a string cannot be merged.

The rendered `Box` is:

```html
<div class="umber-theme-p5e9bg umber-boundary umber-scope">
  <div class="umber-card-root-1l5hymm umber-card-root-qkafnl">
    <p class="umber-qdsl9p">a plain element</p>
  </div>
</div>
```

and the rules for the card:

```css
@layer umber-components {
  .umber-card-root-1l5hymm {
    color: inherit;
  }
}
@layer umber-overrides {
  .umber-card-root-qkafnl {
    padding: var(--umber-space-2);
    background-color: var(--umber-palette-primary);
    opacity: 0.9;
  }
}
```

The component has two classes: its own (`umber-card-root-1l5hymm`) and one override class for everything it was given from outside. The override class is in a later cascade layer, so it wins. See [Cascade layers and overrides](cascade-layers.md).

The `style` prop is only for components made by `styled()`. On a plain element, `style` is the platform's own prop: a sheet entry there is not turned into a class (and writes no style attribute, see [No inline styles](no-inline-styles.md)), and the types reject it. Use `apply` for a plain element.

## `apply`

`apply(...entries)` returns the props that put entries on a plain element:

- React: `{ className }`. Spread it on the element: `<p {...apply(styles.box)} />`. `className` is `undefined` when there is nothing to apply.
- Vue: `{ class }`.
- React Native: `{ style: [...] }`, an array of the entries that are not falsy.

On the web, `apply` also takes class names as strings and passes foreign ones through: `apply(styles.box, 'external')` is `external` followed by the engine class. The entries are merged into one class, with the last winning.

## Overriding a component

A component's own styles are in the `components` layer. What you give it through `style` or an engine class in `className` is in the `overrides` layer, which comes later, so it wins over the component's styles whatever their specificity, nested rules such as `:hover` included. It only wins for what it sets:

```tsx
const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  borderRadius: 8,
  '&:hover': { backgroundColor: theme.palette.hover },
}))

const overrides = StyleSheet.create({
  danger: { backgroundColor: 'firebrick', borderRadius: 0 },
  dangerHover: { '&:hover': { backgroundColor: 'darkred' } },
})

function DangerButton() {
  const styles = useStyle(overrides)
  return <Button style={[styles.danger, styles.dangerHover]}>Delete</Button>
}
```

The button has the Button's class and an override class, and both keep the label:

```html
<button class="umber-button-root-sx8930 umber-button-root-11gr2ac">Delete</button>
```

```css
@layer umber-components {
  .umber-button-root-sx8930 {
    background-color: var(--umber-palette-primary);
    border-radius: 8px;
  }
}
@layer umber-components {
  .umber-button-root-sx8930:hover {
    background-color: var(--umber-palette-hover);
  }
}
@layer umber-overrides {
  .umber-button-root-11gr2ac {
    background-color: firebrick;
    border-radius: 0;
  }
}
@layer umber-overrides {
  .umber-button-root-11gr2ac:hover {
    background-color: darkred;
  }
}
```

Because the override class is in a later layer, its `background-color` beats the Button's `:hover` background even though the entry has no `:hover` rule of its own: a later layer wins whatever the specificity. `dangerHover` is there to give the hovered button a colour of its own.

Without layers (`hasLayers: false`) there is one merged class and the order of the rules decides, so a style given from outside no longer beats a nested rule of the component such as `:hover`, unless it has its own `:hover` rule. See [Cascade layers and overrides](cascade-layers.md).

## One component source for web and mobile

`umber-style/react` is the entry for code that runs on the web and on React Native. Under the `react-native` export condition it is the React Native binding at run time, and for the compiler it is always the same set of types, so one source type-checks the same under both. The names it has are the ones both bindings have: `styled`, `StyleSheet`, `useStyle`, `apply`, `ThemeProvider`, `useTheme`, `themeClass`, `when`, `whenScheme`, `configure`, `createStyle`, `createDefaultStyle`, `alpha`, `at` and the arithmetic helpers. Web-only members (`getEngine`, `engine`, `cache`) are not in its types: import them from `@umber-style/react`.

A tag name works on the web and throws on React Native, so a shared source gets its elements from a module that each platform resolves on its own. React Native's bundler picks `host.native.ts` over `host.ts`:

```ts
// host.ts: the elements of the web
export const Box = 'div'
export const Label = 'span'
```

```ts
// host.native.ts: the same names on React Native
export { View as Box, Text as Label } from 'react-native'
```

Then one file serves both:

```tsx
import { createStyle } from 'umber-style/react'
import { Box, Label } from './host'

const theme = {
  palette: { surface: '#ffffff', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
}

const { styled, ThemeProvider, StyleSheet, useStyle } = createStyle(theme, { prefix: 'umber' })

const Card = styled(Box, { name: 'Card' })(({ theme }) => ({
  backgroundColor: theme.palette.surface,
  padding: theme.space[2],
  borderRadius: 8,
  web: { '&:hover': { opacity: 0.9 }, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)' },
  native: { elevation: 2 },
}))

const Text = styled(Label, { name: 'Text' })({ color: 'inherit' })

const sheet = StyleSheet.create({ title: { fontSize: 18, fontWeight: 'bold' } })

function Title({ children }: { children: string }) {
  const styles = useStyle(sheet)
  return <Text style={styles.title}>{children}</Text>
}

const App = () => (
  <ThemeProvider theme={theme}>
    <Card>
      <Title>Hello</Title>
    </Card>
  </ThemeProvider>
)
```

### The `web` and `native` parts

A shared style has the keys that both platforms understand (`padding`, `opacity`, `flexDirection`, `backgroundColor` and so on). Anything for one platform goes in a part, so that it stays visible in the shared code:

- On the web, `web` is merged over the rest and `native` is dropped.
- On React Native, `native` is merged over the rest and `web` is dropped.

`web` takes a web style and `native` takes a native style, so `elevation` in `web` or `&:hover` in `native` is a type error. The `web` and `native` parts are also resolved at run time in every web binding, not only in `umber-style/react`; only that entry's types allow them.

### Host elements need `styled`

A sheet entry in the `style` prop only works on a component made by `styled()`. In the example, `Text` wraps `Label` for that reason. The compiler rejects an entry given directly to a plain `span`; there you use `apply`.

## Limits

- The shared types are the intersection of the two platforms, so a web-only value (`display: 'grid'`, the `border` shorthand, `display: 'block'`) is a type error in shared code and belongs in `web`. See [Typed styles](typed-styles.md).
- A length with a unit (`'10px'`) and a shorthand with several values type-check in shared code, because the platform's own types accept any string there. React Native warns about them in development; the web writes what you give.
- A shared source that uses `useStyle` or function sheets resolves them with the platform's own rules: on the web, entries are classes, on React Native they are registered objects.
- The `host.native.ts` file was compiled in the React Native package, against the real `react-native` types, apart from the shared source that imports `./host`.
- The shared source was run on the web in a test, and its React Native half is covered by the repository's test of one source on both platforms (`packages/umber-style/src/sharedSource.test.tsx`), which uses a stand-in for the platform.
