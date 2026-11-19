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
