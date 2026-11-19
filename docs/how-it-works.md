# How it works

After this page you can follow a style object to the CSS it becomes, say what a class name and a theme class are, and explain why a style does not depend on the theme.

## From a style object to rules

A style is a plain object. The engine turns it into CSS rules when a component first uses it:

- A key is a CSS property in camelCase. It is written in kebab-case (`backgroundColor` becomes `background-color`, `msTransform` becomes `-ms-transform`). A key that starts with `--` is a custom property and is written as it is.
- A number is a length in pixels (`padding: 8` becomes `padding:8px`), except `0`, custom properties, and properties that take no unit (`opacity`, `zIndex`, `lineHeight`, `flex`, `fontWeight` and the others in the serializer's list).
- An array is a list of fallbacks: `display: ['block', 'grid']` writes `display:block;display:grid;`.
- `null`, `undefined` and `false` are skipped, so `isOpen && { ... }` works.
- A nested object is a nested rule. A key with `&` is a selector where `&` stands for the parent (`'&:hover'`, `'& > p'`). A key without `&` is a descendant selector. A key that starts with `@` wraps the rules in an at-rule (`@media`, `@supports`). A key such as `when(theme)` is a theme condition: see [Theme conditions](theme-conditions.md).
- `label` is not a declaration. It becomes part of the class name.

```ts
const className = engine.css({
  padding: 8,
  '&:hover': { opacity: 0.8 },
  '@media (min-width: 40em)': { padding: 16 },
})
```

returns `umber-1p2a3xt` and writes three rules, each in a cascade layer (see [Cascade layers and overrides](cascade-layers.md)):

```css
@layer umber-components {
  .umber-1p2a3xt {
    padding: 8px;
  }
}
@layer umber-components {
  .umber-1p2a3xt:hover {
    opacity: 0.8;
  }
}
@layer umber-components {
  @media (min-width: 40em) {
    .umber-1p2a3xt {
      padding: 16px;
    }
  }
}
```

There is no CSS processor and no build step. The serializer is a function that runs when the page runs, and the rules are inserted with the browser's `insertRule`.

## Classes and the cache

A cache turns a style into a class name and inserts the rules once. The class name is `<prefix>-<label>-<hash>`:

- `prefix` is the cache's prefix (`css` by default).
- `label` is the style's `label`, which `styled` sets from `name` and `slot` (`umber-button-root-15gvy7r`). It is left out without a name, or with `hasLabels: false`.
- `hash` is a hash of the compiled rules. The same style always gives the same class, in the same or another process, so a server and a browser agree on names.

Several styles merge into one class: later keys win, nested objects merge key by key. `cache.css(a, b)` is one class for both.

Classes that the cache made can be passed back in. They are resolved to their styles and merged, so `engine.css(sheetEntry, { opacity: 0.9 })` is one class, not two.

## Tokens are variables

A theme is a plain object. The engine reads it once and gives back the same shape with a `var(--name)` reference in place of each value:

```ts
const theme = { palette: { primary: '#1b5fd1' }, space: [0, 4, 8, 16] }
const engine = createEngine(theme, { prefix: 'umber' })

engine.refs.palette.primary // 'var(--umber-palette-primary)'
engine.refs.space[2] //        'var(--umber-space-2)'
```

A variable name is `--<prefix>-<path>`, with each path segment in kebab-case. A function style gets these references, so what it writes into the CSS is a reference, never the value.

The value goes somewhere else: a theme class. `engine.themeClass(theme)` makes a class that declares the variables with the theme's values:

```css
.umber-theme-jg3s2a {
  --umber-palette-primary: #1b5fd1;
  --umber-space-2: 8px;
  color-scheme: light;
}
```

Any element below an element with that class sees the values. The variables a class declares are only the ones some rule uses: see [Tokens](tokens.md).

A number under `space`, `sizes`, `radii`, `fontSizes` or `borderWidths` is a length and is declared with `px` (`--umber-space-2:8px`). Other numbers are declared as they are. `breakpoints` and `components` are kept as real values and get no variable: see the token modes in [Tokens](tokens.md).

## One class for every theme

Because a rule holds `var(--umber-palette-primary)` and not `#1b5fd1`, the rule is the same under every theme. Two themes that differ only in token values give the same class:

```tsx
import { createStyle } from '@umber-style/react'

const light = { palette: { primary: '#1b5fd1' } }
const warm = { palette: { primary: '#c2410c' } }

const { styled, ThemeProvider } = createStyle(light, { prefix: 'umber' })

const Tag = styled('span', { name: 'Tag' })(({ theme }) => ({
  color: theme.palette.primary,
}))

const App = () => (
  <ThemeProvider theme={light}>
    <Tag>one</Tag>
    <ThemeProvider theme={warm}>
      <Tag>two</Tag>
    </ThemeProvider>
  </ThemeProvider>
)
```

Both tags get `umber-tag-root-n8ncc0`. The sheet holds one component rule and one theme rule for each theme:

```css
.umber-tag-root-n8ncc0 {
  color: var(--umber-palette-primary);
}
.umber-theme-14mu3wo {
  --umber-palette-primary: #1b5fd1;
}
.umber-theme-1an5zox {
  --umber-palette-primary: #c2410c;
}
```

This is the idea behind the engine:

- A style is computed once, however many themes you have.
- Switching a theme is changing a class, so nothing re-renders and no style is recomputed.
- A theme can be added at run time by making one more theme class: see [The root theme and switching](root-theme.md).

What does depend on the theme is whatever is not a token: a breakpoint, a number you compute with, a function. Those are real values, read from the nearest provider, and a different value makes a different class: see [Themes](themes.md).

## Platforms

The web bindings (`@umber-style/react`, `@umber-style/vue`) use this model. React Native has no CSS and no variables, so `@umber-style/react-native` skips it: a style function receives the real values and returns an object for the platform's own `StyleSheet`. The names (`styled`, `ThemeProvider`, `useTheme`, `StyleSheet`, `useStyle`, `apply`) are the same, so one source can run on both: see [Style sheets and the style prop](style-sheets.md).

## Limits

- The explanation of one class for every theme holds for the `variable` and `reference` token modes. In `inline` mode the real value is written into the rule, so a theme that changes it makes another class. See [Tokens](tokens.md).
- Classes are never removed from the cache or from the style sheet while the page lives. A style that is built from many different values (a measured number, for example) adds one class and its rules for each value. See [No inline styles](no-inline-styles.md).
- The serializer's list of properties that take no unit is fixed in the code. A unitless number for a property that is not in the list gets `px`; write it as a string.
