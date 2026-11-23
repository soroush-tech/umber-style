# Theme conditions

After this page you can write a style that applies only in one theme or one colour scheme: a border only in dark, a shadow only in light, a rule for a specific brand.

Most differences between themes are tokens, and a token needs no condition: the variable changes and the style follows. Use a condition when there is no token to carry the difference.

## `when` and `whenScheme`

Two functions make style keys. They come from the engine, from every binding, and from `createStyle`:

- `when(theme, colorScheme?)` is a key for "the nearest theme is this theme".
- `whenScheme('light' | 'dark')` is a key for "the nearest colour scheme is this one".

The value under a key is a nested style. It may hold selectors and at-rules. In a web style object a key from `when()` is a computed key: the default types take it written directly, and with the strict ones it is written with `at(key, style)`, which spreads `{ [key]: style }` and keeps the style checked: see [Typed styles](typed-styles.md). On React Native, and in a shared style outside its `web` part, the computed key is written directly (see below).

```tsx
import { at, createStyle } from '@umber-style/react'

const lightTheme = {
  palette: { primary: '#1b5fd1', surface: '#ffffff' },
  space: [0, 4, 8, 16],
}
const darkTheme = { palette: { primary: '#8ab4ff', surface: '#101114' } }

const { styled, ThemeProvider, when, whenScheme } = createStyle(lightTheme, { prefix: 'umber' })

const Card = styled('div', { name: 'Card' })({
  border: 'none',
  ...at(when(darkTheme, 'dark'), { border: '1px solid white', '&:hover': { borderColor: 'red' } }),
  ...at(whenScheme('dark'), { boxShadow: 'none' }),
})

const App = () => (
  <ThemeProvider theme={lightTheme} colorScheme="light">
    <Card />
    <ThemeProvider theme={darkTheme} colorScheme="dark">
      <Card />
    </ThemeProvider>
  </ThemeProvider>
)
```

The markup has one class for both cards. The rules decide which applies:

```html
<div class="umber-card-root-c8wvsy"></div>
<div class="umber-theme-8yk78z umber-boundary umber-scheme-dark umber-scope">
  <div class="umber-card-root-c8wvsy"></div>
</div>
```

The outermost provider renders no element: its theme and its `color-scheme: light` are declared on `:root`, which carries no marker class. So the first card follows the system preference for `whenScheme('dark')`, and no `when()` of the light theme can match it. Where a condition must see the theme of the root, put the theme class on `<html>` and render the provider with `isRoot`: see [The root theme and switching](root-theme.md). The nested provider carries the class of the theme it was given (`umber-theme-8yk78z`, which `when(darkTheme, 'dark')` names), and the markers; directly under the outermost provider it has no second theme class (see [Themes](themes.md#the-provider)).

```text
@layer umber-components{.umber-card-root-c8wvsy{border:none;}}
@layer umber-components{@scope (.umber-theme-8yk78z) to (.umber-boundary){.umber-card-root-c8wvsy{border:1px solid white;}.umber-card-root-c8wvsy:hover{border-color:red;}}}
@layer umber-components{@scope (.umber-scheme-dark) to (.umber-scheme-light,.umber-scheme-dark){.umber-card-root-c8wvsy{box-shadow:none;}}}
@layer umber-components{@media (prefers-color-scheme: dark){.umber-card-root-c8wvsy:where(:not(.umber-scheme-light,.umber-scheme-dark,.umber-scheme-light *,.umber-scheme-dark *)){box-shadow:none;}}}
```

The first rule is the base style. The scoped rule beats it: it has the same specificity and a scoped rule wins over an unscoped one before source order is looked at. The guarded media rule has no specificity.

## What "nearest" means

`when(theme)` applies where the nearest theme element above is `theme`. `themeClass(theme)` adds the `umber-boundary` class to every theme element, and the rule is an `@scope` that starts at the theme's class and ends at the next boundary. So a nested theme cuts the outer one off: in a page with themes A, then B inside it, then A inside B, a `when(A)` rule applies below the first A, not below B, and again below the second A.

Pass the same `colorScheme` to `when` that you give the provider. `when(darkTheme, 'dark')` and `when(darkTheme)` are different theme classes, and only the one that the provider rendered matches.

`whenScheme('dark')` applies where the nearest theme that was given a `colorScheme` has that scheme. With no such theme above, the system preference decides: that is the `@media (prefers-color-scheme: dark)` rule, guarded so that it does not apply below a theme that has a scheme of its own. A theme with no `colorScheme`, or with `'light dark'`, is not a scheme boundary.

## Without `@scope`

Pass `hasScope: false` (to `createStyle`, `createEngine` or `createCache`) to write the plain form instead:

```text
@layer umber-components{:where(.umber-theme-l0twti) .umber-oko3jm{border:1px solid white;}}
```

It matches below any element with that theme class, nested themes included, so it is wrong for nested themes: a `when(A)` rule would also apply inside B when B is inside A. There is no detection at run time: choose the option.

## React Native

On React Native there are no classes. A condition is matched when the component renders:

- `when(theme)` applies where the nearest provider was given that theme object. The comparison is by identity: the same object, not an equal one. With no provider above, the base theme given to `createStyle(theme)` or `configure({ theme })` counts.
- `whenScheme(scheme)` applies where the nearest provider with a `colorScheme` has it; with none above, the platform's colour scheme at render time.

The matching parts are merged over the rest of the style, in order, on each render. A component that has a condition key reads the provider context; one without does not.

```tsx
const Card = styled(View)({
  padding: 8,
  [when(dark)]: { padding: 4 },
  [whenScheme('dark')]: { opacity: 0.5 },
})
```

`colorScheme` of `when(theme, colorScheme)` is not used on React Native. The same source, with `when` and `whenScheme` at the top of a shared style, matches the nearest provider on React Native and compiles to the scoped rules on the web: see [Style sheets and the style prop](style-sheets.md).

## State keys

A third kind of condition key names what the element is doing, not the theme around it: `state('hovered')`, `state('pressed')`, `state('focused')` and `state('disabled')` ([Writing styles](writing-styles.md#interaction-states)). It is written with `at` like the keys above, and it nests in them and they in it:

```ts
const nested = {
  [when(dark)]: { ...at(state('pressed'), { opacity: 0.5 }) },
  '@media (min-width: 600px)': { ...at(state('disabled'), { opacity: 0.3 }) },
}
```

On the web a state key is not scoped: it is the selector written by hand for its state (`&:active` for `pressed`), so inside `when(dark)` the rule above is the scoped rule of `.card:active`. On React Native it is matched when the component renders, as `when()` is, against the component's state instead of the nearest provider: see [React Native](react-native.md#interaction-states). `packages/core/src/state.test.ts` checks that the nested form gives the same rules and class as the selectors written by hand, and `packages/react-native/src/states.test.tsx` that a state part inside a `when()` part, and a media and a scheme part inside a state part, apply on React Native.

## Limits

- A conditional style applies to the descendants of the theme element, not to the element that carries the theme class. With the class on `<html>` this is the whole page below it.
- The outermost provider, without `isRoot`, declares its theme on `:root` and gives no marker: below it and outside any nested provider, `when()` of its theme does not match and `whenScheme()` follows the system preference.
- A condition inside a `::before` selector cannot take the guard that `whenScheme` needs for the system preference.
- Call `when(theme)` after the base theme is known (`createStyle(theme)` or `configure({ theme })`). It makes the theme class like `themeClass` does, and if there is no base theme yet, the theme you pass gives the engine its shape (not a given base theme: see [Themes](themes.md#the-base-theme)).
- `@scope` needs a browser that supports it. One that does not drops those rules and keeps the rest, so the style falls back to the base style. The versions are to be confirmed: see [Browser and platform support](browser-support.md).
- The "nearest theme" behaviour is checked in a test with jsdom, which evaluates `@scope`, inside a layer too: a card under A, then B, then A gets the conditional style below the first A, not below B, and again below the second A (`packages/core/src/createEngine.conditions.test.ts`). `whenScheme` and the system-preference rule are checked as rule text only. No real browser was used.
- Typing: with the strict style types, a computed key made by `when()` written directly in a web style object is a type error, because TypeScript types a computed key as `string`: use `at()`, as above. The style inside `at()` is checked like any style. See [Typed styles](typed-styles.md).
- On React Native the types accept the condition keys and do not check what is inside them.
- A state key is not a scoped rule on the web: it is a selector, decided by the browser on the element itself. What a state means on React Native, and what was not observed there, is in [React Native](react-native.md#limits).
