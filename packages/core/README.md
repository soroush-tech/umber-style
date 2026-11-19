# @umber-style/core

The UmberStyle engine: theme tokens as CSS variables, the class cache and theme classes. It knows no framework.

Not yet published. Once it is: `pnpm add @umber-style/core`.

```ts
import { createEngine } from '@umber-style/core'

const engine = createEngine({ palette: { primary: '#1b5fd1' } }, { prefix: 'app' })
```

## Typed styles

`WebStyleObject` is the type of a style on the web: every CSS property with its values (a number where CSS takes a length, a list for fallbacks), nested styles under a selector (a key with `&`, or one that starts with `:`) or an at-rule (a key that starts with `@`), custom properties (`--name`) and `label`. `engine.css`, `createSheet`, `createStyler` and the `styled`, `StyleSheet.create` and `style` of the web bindings take it.

```ts
styled('div')({
  display: 'grid',
  padding: 8,
  '&:hover': { opacity: 0.8 },
  '@media (min-width: 40em)': { padding: 16 },
  '--accent': '#1b5fd1',
})
```

What is checked: in an object literal, a key that is not a property, a selector or an at-rule (`backgroudColor`), and a wrong value where CSS has a closed set of keywords (`display: 'gird'`). What is not: a misspelt key in an object that a variable holds (`const s = { color: 'red', backgroudColor: 'red' }`), or in the object that a style function returns without a return type (give the function a return type of `WebStyleObject`, or end the literal with `satisfies WebStyleObject`); and a value that CSS cannot list (a color, a length with a unit) is any string.

`StyleObject`, with any key, is the loose type that the serializer works on. It is the escape hatch: a value of that type is given to a style through a cast, `style as WebStyleObject`.

The typings of the CSS properties come from the standard `csstype` package. It is a `dependency` and is only imported as a type, so the core has no runtime dependency on it; the declarations the core publishes refer to it, and a consumer without it would see every property as `any`.

## Arithmetic on tokens

On the web a token is a reference string such as `var(--space-2)`, so JavaScript cannot add to it. `multiply`, `divide`, `add`, `subtract` and `negate` return CSS that the browser computes; two numbers are computed directly.

```ts
import { add, multiply, negate } from '@umber-style/core'

styled('div')(({ theme }) => ({
  padding: multiply(theme.space[1], 2), // calc(var(--space-1) * 2)
  marginLeft: negate(theme.space[2]), // calc(var(--space-2) * -1)
  width: add(theme.space[3], 4), // calc(var(--space-3) + 4px)
}))
```

| Call                                    | Result                               |
| --------------------------------------- | ------------------------------------ |
| `multiply(8, 2)`                        | `16`                                 |
| `multiply('var(--space-2)', 2)`         | `'calc(var(--space-2) * 2)'`         |
| `multiply('8px', 2)`                    | `'16px'` (a literal length computes) |
| `multiply(x, 1)`, `divide(x, 1)`        | `x`                                  |
| `multiply(x, 0)`                        | `0`                                  |
| `divide('var(--space-2)', 2)`           | `'calc(var(--space-2) / 2)'`         |
| `divide(x, 0)`                          | throws a `RangeError`                |
| `add(4, 4)`                             | `8`                                  |
| `add('var(--space-2)', 4)`              | `'calc(var(--space-2) + 4px)'`       |
| `add('8px', '4px')`                     | `'12px'` (same unit only)            |
| `add('8px', '1em')`                     | `'calc(8px + 1em)'`                  |
| `add(x)`, `add(x, 0)`, `subtract(x, 0)` | `x`                                  |
| `subtract('var(--space-2)', 4)`         | `'calc(var(--space-2) - 4px)'`       |
| `negate('var(--space-2)')`              | `'calc(var(--space-2) * -1)'`        |
| `add(multiply(a, 2), b)`                | `'calc((a * 2) + b)'`                |

A number next to a string in `add` and `subtract` is a length in px; the second argument of `multiply` and `divide` is always a unitless factor. An operand that is already a `calc(...)` goes in parentheses, so a calc is never nested inside a calc. A factor or a number that is not finite throws a `RangeError`, an operand that is neither a string nor a number a `TypeError`. The result is typed `number` when every argument is a number, otherwise `string | number`; a token typed as the number it is on React Native is therefore typed `number` here too.

## Cascade layers

Every rule the engine writes is in a CSS cascade layer. The layers are named after the cache prefix
(`css` by default) and declared in this order, lowest priority first, by the first rule of the sheet:

```css
@layer css-theme, css-global, css-components, css-overrides;
```

| Layer                 | What goes in it                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `<prefix>-theme`      | The theme scope classes (the token variables) and the `display: contents` scope rule.            |
| `<prefix>-global`     | Reserved for global styles. Nothing is written there yet.                                        |
| `<prefix>-components` | The own styles of a `styled` component, and sheet entries used on their own (`css`, `apply`).    |
| `<prefix>-overrides`  | What a component is given from outside: its `style` prop, and engine classes in its `className`. |

A later layer beats an earlier one whatever the specificity, so
`<Button style={{ background: 'purple' }}>` beats the `&:hover` background of the Button.

An element made by `styled` can carry two engine classes: its component class and, only when
something is given from outside, one override class (all of it merged, the last winning). Class
names that are not the engine's pass through. `styled(Button)(more)` is still one component class.

Unlayered CSS always beats layered CSS, whatever its specificity. That makes it easy for an app's own
stylesheet to override a component. It also means that an unlayered reset such as
`button { background: none }` overrides component styles. Put a reset in a layer that is declared
before the engine's:

```css
@layer reset, css-theme, css-global, css-components, css-overrides;
@layer reset {
  button {
    background: none;
  }
}
```

The order of layers is fixed by the first place each name is declared in the document, across all
style sheets, and a later statement never reorders it. The engine's own statement does not help
here: it comes first in the engine's sheet, but a sheet that the app adds after it would put `reset`
after `css-overrides`, which gives the reset the highest priority. So the app's statement must be in a
style or link that comes before the engine's `<style>` in the document. (The same holds for the
server build, where every `<style href precedence>` starts with the statement.)

Layers need a browser from 2022 on (Chrome 99, Firefox 97, Safari 15.4); an older one drops the
rules. Pass `hasLayers: false` (to `createCache`, `createStyle` or `configure`) to turn them off: no
`@layer` is written and an element gets one merged class, as before. A style given from outside then
does not beat a nested rule of the component such as `:hover`.
