# Style sheets and the style prop

After this page you can keep named styles in a sheet, make one style once with `css()` and pass it around, apply them to styled components and plain elements, override a component from outside, and write one component source that runs on the web and on React Native.

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

`StyleSheet.create` takes a function of the theme that returns the styles, or an object of styles. They give different things:

- A **function** receives the theme as references, like a function style, and gives a sheet. `useStyle(sheet)` resolves it against the nearest provider and returns one entry for each name: a theme that changes a breakpoint gets its own entries. Each name of the sheet is also a handle, `sheet.box`, that the `style` prop of a styled component resolves with its own theme, with no hook: see "A sheet of the theme without a hook" below. The sheet itself is not an entry: `apply(sheet)` and `style={sheet}` are type errors.
- An **object** gives the entries themselves, at once, with no hook: see "A sheet without a hook" below.

On the web an entry is a frozen object that holds a class name. It prints as that class name (`String(entry)` and `entry.className` agree). On React Native an entry is a style object. Treat an entry as opaque: pass it on, do not read it, so that your code runs on both platforms.

`useStyle` is a hook on React (call it in a component) and must run in `setup` on Vue. `StyleSheet.create` is not a hook.

## A sheet without a hook

Given an object, `StyleSheet.create` returns the entries, and they are usable where the sheet is made: in a `style` prop, in `apply`, in another module. `useStyle` is not needed, and given an object sheet it returns the same object, so existing code that calls it keeps working.

```tsx
const overrides = StyleSheet.create({
  danger: { backgroundColor: 'firebrick', borderRadius: 0 },
})

const Page = () => <Button style={overrides.danger}>Delete</Button>
```

An object sheet has no theme. It works with no theme set and with no provider above it, in the server components build and before any provider has rendered, and a module can create one before the app calls `configure()`. Nothing is computed when `create` is called: an entry is made when its key is first read, and a sheet that is imported and never used writes nothing. `Object.keys` and a spread list the keys (the entries of a sheet that was only imported are not made until a spread reads them).

Its limit is that it cannot use tokens. A token is a reference that comes from the theme, so a style that needs `theme.palette.primary` is written as a function: `StyleSheet.create((theme) => ({ ... }))`. An object can still use plain values and `var(--name)` strings that you write yourself. On React Native an object sheet is registered with the platform when its first key is read, and a `when()` or `whenScheme()` key in it is dropped, because there is no hook to read the providers: use a function sheet for those.

## A sheet of the theme without a hook

A styled component takes a handle of a sheet made from a function of the theme in `style`, and resolves it with the theme it renders under. From `packages/react/src/sheetHandle.test.tsx`:

```tsx
const sheet = StyleSheet.create((theme) => ({
  box: {
    color: theme.palette.primary,
    ...at(`@media (width >= ${theme.breakpoints[0]})`, { margin: 1 }),
  },
  raised: { opacity: 0.9 },
}))

const Static = styled('div', { name: 'Static' })({ display: 'block' })

const Box = () => <Static style={[sheet.box, false, sheet.raised, { width: 1 }]} />
```

`sheet.box` is a handle: a frozen object that holds the sheet and the name, made the first time it is read and the same object after (`sheet.box === sheet.box`). Making it computes nothing. When the component renders, it reads the entry with the binding's own `useStyle(sheet).box`, so the class and the rules are exactly those of `useStyle(sheet).box` under the same provider: on the server and in the browser, under nested providers with different themes, under a `CacheProvider` (written in its cache), and in the server components build, where the theme is the base theme as a server component reads it. A handle works alone, in a list, mixed with entries and plain objects, and with `false`, `null` and `undefined`, as an entry does. On React Native the handle is resolved into the registered style object that `useStyle` gives, and it follows a rotation of the window (see [React Native](react-native.md#handles-of-a-sheet-of-the-theme)).

`useStyle` is still the way where there is no styled component:

- a plain element: `apply(useStyle(sheet).box)`, or `className={String(useStyle(sheet).box)}`;
- code that reads an entry or passes it to something that is not a styled component of this engine (another library's component, a `className` prop of your own);
- a value of the theme in JavaScript: that is `useTheme()`, as before.

A handle given where no theme is known is a type error, and a `TypeError` in every build, development and production. The places are `apply`, `css()`, the styles of `styled` (`styled('div')(sheet.box)`), `globalStyles` and `Global`, React Native's `apply` and `css()`, and a plain element: in the client build of React and on React Native a plain element reads the keys of its `style`, which a handle answers with the error, and `String(sheet.box)` (a `className`) throws too. In a server component of React a plain element given a handle in `style` writes nothing instead (see the Limits). The message names the place and the fix:

```text
apply(): an entry of a sheet made from a function of the theme (StyleSheet.create((theme) => ...)) has no theme here. Give it to the style prop of a styled component, which resolves it with its theme, or read the entry from useStyle(sheet) first.
```

A name that the sheet does not have is a type error, and at run time the component throws `The sheet has no style named "missing".` Some names are never handles, because frameworks and serializers read them on any object: the sheet's own members (`resolve`, and `prepare` on React Native), the members every object has (`toString`, `valueOf`, `constructor`, `hasOwnProperty` and the rest), `then`, `toJSON`, `$$typeof`, and any name that starts with `__`. A style with such a name is reached through `useStyle` only.

## When a rule is written

Resolving a sheet writes no rule. An entry writes its rule when it is first used, and an entry can be used in two ways:

- on its own, through `apply` or on a plain element, or by reading `className`: its class is in the `components` layer;
- given alone to a styled component through `style`: its class is in the `overrides` layer.

These are two classes, because one class name cannot be in two layers. Each is written only when the entry is first used that way: an entry that is only ever given through `style` writes one rule, in `overrides`, and none in `components`; one that is used both ways writes one rule for each. Merging an entry into another class (more than one thing given, see below) does not use its own class, so it writes neither.

## The `style` prop of a styled component

A component made by `styled()` takes `style`, and this is the engine's own API, not an inline style. It takes sheet entries and style objects, in arrays, with `false`, `null` and `undefined` dropped; on React by default also a `CSSProperties` object, which is a style object too. All of it is merged, in order, into one class, and no `style` attribute is rendered. A string is an error, because a string cannot be merged.

The rendered `Box` is:

```html
<div class="umber-card-root-1l5hymm umber-card-root-qkafnl">
  <p class="umber-qdsl9p">a plain element</p>
</div>
```

(The provider around it is the outermost one: it renders no element, and its theme is on `:root`.)

and the rules for the card:

```text
@layer umber-components{.umber-card-root-1l5hymm{color:inherit;}}
@layer umber-overrides{.umber-card-root-qkafnl{padding:var(--umber-space-2);background-color:var(--umber-palette-primary);opacity:0.9;}}
```

The component has two classes: its own (`umber-card-root-1l5hymm`) and one override class for everything it was given from outside. A component that has props-dependent styles has a base class and a props class instead of the one, see [Cascade layers and overrides](cascade-layers.md). The override class is in a later cascade layer, so it wins.

Here three things were given (two entries and an object), so they are merged into one new class, which keeps the label of the component. When exactly one sheet entry is given, and nothing else that needs merging (no plain object, no second entry, no engine class in `className`), the entry's own class is the override class: no second class is made, and the same entry given to ten components is one rule. Class names that are not the engine's do not count: they pass through.

### How long a class of `style` lives

| Given in `style`                               | Result                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| a `StyleSheet.create` entry or a `css()` value | its own cached class, permanent, shared by every user              |
| a plain object, `{ width: x }`                 | a class for that value, removed when no element uses it            |
| a list of both                                 | one merged class, removed when unused; the entry's own class stays |
| anything on a plain element                    | the framework's own `style` attribute; the engine is not involved  |

In the browser, an element that is given a plain object counts the class it renders, and the class is removed from the sheet one macrotask after the last element lets it go: a value that changes leaves no class behind. Two elements with the same value share the class. On a server nothing is removed. See "A value that changes" in [No inline styles](no-inline-styles.md) for what it costs.

The `style` prop is only for components made by `styled()`. On a plain element, `style` is the platform's own prop: a sheet entry there is not turned into a class (and writes no style attribute, see [No inline styles](no-inline-styles.md)), and the types reject it. Use `apply` for a plain element.

### A style passed from a server component

A style does not cross from a server component to a client component. React turns the props of a client component into data, and an entry, an entry of an object sheet, a handle, a `css()` value or a class name arrives there without its CSS: the styled component of the client gets a class that no rule names, or nothing, and is unstyled. Import the sheet in the client component, and pass a plain value, a string or a boolean, to choose the style there. The page `/csp-server/sheets` of the App Router fixture does it.

The sheet, imported by both sides (`fixtures/next-app/app/(csp-server)/sheets.ts`, shortened):

```ts
export const sheet = StyleSheet.create((theme) => ({
  card: {
    paddingLeft: 31,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.palette.accent,
  },
  label: { paddingLeft: 43, color: theme.palette.accent },
}))
```

The client component chooses the style from a plain value (`sheets-client.tsx`):

```tsx
'use client'

import { sheet } from './sheets'
import { styled } from './style'

const Card = styled('section', { name: 'CspServerSheetCard' })({ display: 'block', marginTop: 2 })

/** A card whose style the server component chooses with a plain value: the way to do it. */
export function ClientPicked({ tone }: { tone: 'card' | 'label' }) {
  return (
    <Card data-testid="sheets-client-picked" style={sheet[tone]}>
      picked
    </Card>
  )
}
```

And the server component passes the value, not the style (`csp-server/sheets/page.tsx`):

```tsx
<ClientPicked tone="card" />
```

In development, a styled component of React given what such a style became (an object of one key, `--umber-entry-<class>` or `--umber-themed-<id>`, with no CSS) warns once for each key (here for the entry of `StyleSheet.create({ card: { color: 'red' } }).card` under the prefix `umber`):

```text
[umber] A style was passed from a server component to a client component (--umber-entry-umber-bkhmwp), and its CSS cannot cross: import the sheet in the client component, and pass a plain value such as a string to choose the style.
```

A class name passed as text, `String(entry)` or `entry.className`, carries no rule either, and the development check of the page says so:

```text
[umber] p[] has the class umber-bkhmwp, which no rule names: if it is the class of a sheet entry passed as text (String(entry), entry.className), use the entry itself where the style is used, importing its sheet there: a class name carries no rule
```

The slot pattern, an object of entries for the parts of a component (`styleProps={{ root: sheet.root, avatar: sheet.avatar }}`), works within one side: a client component passing them to its styled client children, or a server component to its styled server children.

## `apply`

`apply(...entries)` returns the props that put entries on a plain element:

- React: `{ className }`. Spread it on the element: `<p {...apply(styles.box)} />`. `className` is `undefined` when there is nothing to apply.
- Vue: `{ class }`.
- React Native: `{ style: [...] }`, an array of the entries that are not falsy.

On the web, `apply` also takes class names as strings and passes foreign ones through: `apply(styles.box, 'external')` is `external` followed by the engine class. The entries are merged into one class, with the last winning.

## `css()`

`css(...styles)` makes one style, once, for a module to pass around. It takes style objects, `css()` values and sheet entries, and lists of them, with `false`, `null` and `undefined` dropped, and merges them in order, the last winning. Used as a tag, it reads the template as CSS text (see [Writing styles](writing-styles.md)). It is exported by `@umber-style/react` (both builds), `@umber-style/vue`, `@umber-style/react-native`, `umber-style/react` and `umber-style/vue`, and is on what `createStyle()` returns.

```tsx
const { css, styled, apply } = createStyle(theme, { prefix: 'umber' })

const card = css({ padding: 8, borderRadius: 4 })
const danger = css(card, { backgroundColor: 'firebrick' })
const raised = css`
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
`

const Button = styled('button', { name: 'Button' })(card, { color: 'white' })

const App = () => (
  <>
    <Button style={danger}>Delete</Button>
    <p className={String(raised)}>raised</p>
    <p {...apply(card, raised)}>both</p>
  </>
)
```

On the web the value is a sheet entry of the merged style: an entry like one of `StyleSheet.create`, with the same rules for when its rule is written (above). Equal styles give the same class, however they were written. It goes:

- where a class name goes, as text: `String(value)` and `value.className` are its class name. React and Vue would turn it into text themselves, but React types `className` as a string, and Vue reads an object given to `class` as a map of class names, so `class: value` gives no class: write `String(value)` or `apply(value)`;
- in the `style` prop of a styled component, alone (its own class in the `overrides` layer, permanent, shared by every user) or in a list (merged with the rest);
- in another `css()`, in `apply`, among the styles of `styled` (`Button` above), and under a selector of global styles (`{ body: value }`);
- as the `styles` of `Global`, alone, in a list, or returned by a function of the theme: its nested rules are then global rules as they are written (`html,body{margin:0;}`), and a declaration outside every selector is left out with a warning in development (see [Animations and global styles](animations-and-global-styles.md#what-styles-takes)). Its `styles` text still reads as a class would write it (`& html{...}`).

On the web the value also has `name` and `styles`. Reading either writes no rule:

- `name` is the class name of the value used on its own: what `String(value)`, `className` and `apply(value)` give, and what a plain element gets. Given alone to the `style` of a styled component the value gets another class, in the `overrides` layer.
- `styles` is the CSS text of the style, in the engine's text format (see [How it works](how-it-works.md#the-text-of-a-rule)): its declarations, then each nested rule as the engine writes it, with `&` standing for the class (`&:hover{...}`, `@media (min-width: 40em){&{...}}`). It is made the first time it is read.

The values are those of the object. From `packages/react/src/css.test.tsx`, an app's helper that makes a `css()` value from the theme that `useTheme()` returns:

```tsx
const createGlobalStyles = (real: typeof theme) =>
  css({ '&::backdrop': { backgroundColor: real.palette.primary }, border: 'none' })

function Reader() {
  const value = createGlobalStyles(useTheme())
  // value.styles is 'border:none;&::backdrop{background-color:#0000ff;}'
  return <Global styles={{ dialog: value }} />
}
```

`styles` holds the real values of the theme, `#0000ff`, because the object holds them. An object built from the theme that a style function gets holds references, and its `styles` holds `var(--umber-palette-primary)`.

A function, given as an argument (alone or in a list) or as an interpolation of the template, is a `TypeError`: `css()` makes a class with no component, so it has no props or theme to call the function with. The message is the same in every binding and in `@umber-style/css`, and says what takes a function instead (`packages/react/src/css.test.tsx`):

```text
css(): a function is not a style here, as an argument or as an interpolation: css() makes a class with no component, so it has no props or theme to call it with. For a value of the props, use a styled component's style function; for a value of the theme, give an entry of StyleSheet.create((theme) => ...) to the style prop.
```

A value of the props is written in a style function of a styled component; a value of the theme, in a sheet of `StyleSheet.create((theme) => ...)` whose entry goes in the `style` prop. With `css` of `createStyle()` the error comes at the call; with `css` of the default style it comes at the first use of the value, where the entry is made (below).

`css` of the default style (`import { css } from '@umber-style/react'`) can be called at module level before `configure()`: the value stands for the entry, which is made on its first use, with the options that `configure` gave. `css` of `createStyle()` makes the entry at once.

On React Native `css()` returns the merged native style: each style is turned into a native style as a sheet entry is (lengths in `px` and `rem` become numbers, web-only keys are dropped), then merged, the last key winning. It goes in `style`, and the template form is read the same way: see [React Native](react-native.md).

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
  return <Button style={[overrides.danger, overrides.dangerHover]}>Delete</Button>
}
```

The button has the Button's class and an override class, and both keep the label:

```html
<button class="umber-button-root-sx8930 umber-button-root-11gr2ac">Delete</button>
```

```text
@layer umber-components{.umber-button-root-sx8930{background-color:var(--umber-palette-primary);border-radius:8px;}}
@layer umber-components{.umber-button-root-sx8930:hover{background-color:var(--umber-palette-hover);}}
@layer umber-overrides{.umber-button-root-11gr2ac{background-color:firebrick;border-radius:0;}}
@layer umber-overrides{.umber-button-root-11gr2ac:hover{background-color:darkred;}}
```

Because the override class is in a later layer, its `background-color` beats the Button's `:hover` background even though the entry has no `:hover` rule of its own: a later layer wins whatever the specificity. `dangerHover` is there to give the hovered button a colour of its own.

Given one entry alone, `<Button style={overrides.danger}>Delete</Button>`, the button is `<button class="umber-button-root-sx8930 umber-sz1m68">`, and the entry's own override class is the only rule written for it:

```text
@layer umber-overrides{.umber-sz1m68{background-color:firebrick;border-radius:0;}}
```

That class has no label of the Button, because it is the entry's class and the same one for every component that is given the entry. With `hasLayers: false` there is no such class: what is given from outside is always merged into the one class.

Without layers (`hasLayers: false`) there is one merged class and the order of the rules decides, so a style given from outside no longer beats a nested rule of the component such as `:hover`, unless it has its own `:hover` rule. See [Cascade layers and overrides](cascade-layers.md).

## One component source for web and mobile

`umber-style/react` is the entry for code that runs on the web and on React Native. Under the `react-native` export condition it is the React Native binding at run time, and for the compiler it is always the same set of types, so one source type-checks the same under both. The names it has are the ones both bindings have: `styled`, `StyleSheet`, `useStyle`, `apply`, `css`, `ThemeProvider`, `useTheme`, `themeClass`, `when`, `whenScheme`, `configure`, `createStyle`, `createDefaultStyle`, `alpha`, `at`, the arithmetic helpers, `keyframes`, `globalStyles` and `Global` (on React Native the last three compile and do nothing: see [Animations and global styles](animations-and-global-styles.md)). Web-only members (`getEngine`, `engine`, `cache`) are not in its types: import them from `@umber-style/react`.

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

- `name` and `styles` of a `css()` value exist on the web only: on React Native `css()` returns a native style. `styles` is the text of the style alone, not of the rule a cache writes for it: there is no class and no cascade layer in it.
- The shared types are the intersection of the two platforms, so a web-only value (`display: 'grid'`, the `border` shorthand, `display: 'block'`) is a type error in shared code and belongs in `web`. See [Typed styles](typed-styles.md).
- A length with a unit (`'10px'`) and a shorthand with several values type-check in shared code, because the platform's own types accept any string there. React Native warns about them in development; the web writes what you give.
- An object sheet cannot use tokens, and on React Native it drops `when()` and `whenScheme()` keys. Both need a function sheet and `useStyle`.
- The rule that one entry given alone is the override class holds with layers; without layers it is merged.
- A class made from a plain object is removed only in the browser and only by a sheet that can remove rules. Each new value of such an object writes one rule and later removes one: slower than a style attribute.
- The override class is in the `overrides` layer, so an `!important` rule of the app, or CSS outside the engine's layers, wins over it. A style attribute would win over every normal rule.
- A `css()` value of the default style is a stand-in until its first use: any use (a read, a spread, `in`, a listing of its keys) makes it. A template given to it is read then, so a template that cannot be read throws at that first use, not at the call. A value given to `globalStyles` at module level is used there (the id of the global styles is made from it), so it makes the default style's engine, and a `configure()` after that throws.
- `css()` takes no class name as a string, and no sheet entry that is only a class name (one that a cache did not make): both are errors, because their style is not known.
- A handle on a plain Vue element, in Vue's `style` or `class`, writes nothing and raises no error: Vue reads its key, which holds `null` there so that Vue's merge of a list keeps it. The types reject it.
- In a server component of React, `<div style={sheet.box}>` writes nothing and raises no error either: the handles of the server components build hold `null` in their key, because React reads every key of a prop for its development messages, and a key that throws made the page fail on the development server. This departs from the `TypeError` of a plain element that the client build gives; the types reject it, and `className={sheet.box}` still throws.
- A styled component given a handle on React Native renders through an inner component; switching its `style` between a handle and none mounts its element again. On the web nothing changes in the tree.
- A style passed from a server component to a client component is unstyled ("A style passed from a server component" above). The development warning is given in the React builds only, for an object of that one key: in Vue, or with other keys in the same object, nothing says so.
- In a template a `css()` value is merged only when it stands alone on its line; see the limits of [Writing styles](writing-styles.md).
- A shared source that uses `useStyle` or function sheets resolves them with the platform's own rules: on the web, entries are classes, on React Native they are registered objects.
- The `host.native.ts` file was compiled in the React Native package, against the real `react-native` types, apart from the shared source that imports `./host`.
- The shared source was run on the web in a test, and its React Native half is covered by the repository's test of one source on both platforms (`packages/umber-style/src/sharedSource.test.tsx`), which uses a stand-in for the platform.
