# umber-style

The UmberStyle umbrella: it only re-exports the engine and the bindings as `umber-style`, `umber-style/react`, `umber-style/react-native` and `umber-style/vue`.

Not yet published. Once it is: `pnpm add umber-style`.

```ts
import { styled, ThemeProvider } from 'umber-style/react'
```

## Typed styles

Every entry checks the keys of a style in an object literal, for its own platform:

| Entry                                      | Keys allowed                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `umber-style/vue` and `@umber-style/react` | every CSS property, nested selectors and at-rules, custom properties (`--x`) and `label` |
| `umber-style/react-native`                 | the platform's view, text and image style keys; nothing nested                           |
| `umber-style/react`                        | only the keys that both of them have, with the values that both accept                   |

`umber-style/react` is the entry for code that runs on the web and on React Native. Under the `react-native` export condition it is the React Native binding at run time, and for the compiler the entry is always the same set of types, so one source type-checks the same under both. `display: 'grid'`, a nested selector, `elevation` or `label` at the top level of a shared style is an error.

A shared style has two parts for one platform each, so that a platform-only thing stays visible in the shared code:

```ts
const Card = styled(View)({
  padding: 8,
  web: { '&:hover': { opacity: 0.8 } },
  native: { elevation: 2 },
})
```

On the web `web` is merged over the rest and `native` is dropped; on React Native `native` is merged over the rest and `web` is dropped. `web` takes a web style, `native` takes a native style, so a native-only key inside `web` is an error and the other way round. The types are `SharedStyleObject`, `WebStyleObject` and `NativeStyleObject`.

The shared entry has the names that both bindings have (`styled`, `StyleSheet`, `useStyle`, `apply`, `ThemeProvider`, `useTheme`, `themeClass`, `configure`, `createStyle`, `alpha`). What only the web has (`getEngine`, `engine`, `cache`) is imported from `@umber-style/react`. A tag name such as `'div'` type-checks in shared code and throws on React Native: give `styled` a component there.

To use a key that a type does not know, cast the style to the type of the platform: `style as WebStyleObject`, or `style as NativeStyleObject`. `StyleObject` is the loose type of the engine and is cast the same way.

## Arithmetic on tokens

On the web a token is a reference string such as `var(--space-2)`, so `theme.space[2] * 2` is not a number. `multiply`, `divide`, `add`, `subtract` and `negate` do the arithmetic on both platforms: on the web they return CSS that the browser computes, on React Native the real number. They are exported by `umber-style/react` and by `@umber-style/core` (web), and by `@umber-style/react-native`.

```ts
import { multiply, negate, styled } from 'umber-style/react'

const Card = styled(View)(({ theme }) => ({
  padding: multiply(theme.space[1], 2),
  marginLeft: negate(theme.space[2]),
}))
```

| Call                          | On the web                     | On React Native                                       |
| ----------------------------- | ------------------------------ | ----------------------------------------------------- |
| `multiply(theme.space[1], 2)` | `'calc(var(--space-1) * 2)'`   | `8` (for a token of 4)                                |
| `negate(theme.space[2])`      | `'calc(var(--space-2) * -1)'`  | `-8`                                                  |
| `divide(theme.space[2], 2)`   | `'calc(var(--space-2) / 2)'`   | `4`                                                   |
| `add(theme.space[2], 4)`      | `'calc(var(--space-2) + 4px)'` | `12`                                                  |
| `subtract(theme.space[2], 4)` | `'calc(var(--space-2) - 4px)'` | `4`                                                   |
| `multiply(8, 2)`              | `16`                           | `16`                                                  |
| `multiply('8px', 2)`          | `'16px'`                       | `16` (`px` or no unit is a number)                    |
| `multiply('50%', 2)`          | `'100%'`                       | `'100%'`                                              |
| `add('50%', '10%')`           | `'60%'`                        | `'60%'`                                               |
| `add('50%', 4)`               | `'calc(50% + 4px)'`            | throws a `TypeError`                                  |
| `multiply('var(--x)', 2)`     | `'calc(var(--x) * 2)'`         | throws a `TypeError` (names the helper and the value) |
| `add('8px', '1em')`           | `'calc(8px + 1em)'`            | throws a `TypeError`                                  |
| `multiply(x, 1)`, `add(x, 0)` | `x`                            | `x` as a number                                       |
| `divide(x, 0)`                | throws a `RangeError`          | throws a `RangeError`                                 |

On React Native a percentage stays a percentage for `multiply`, `divide` and `negate`, and for `add` and `subtract` when every operand is one; anything that cannot be computed (a `var(...)` string, mixed units) throws, because a silently wrong value would be worse. The shared types take numbers and percentages only, so a reference string or a length with a unit is a type error in shared code. Write those in the `web` part.

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
