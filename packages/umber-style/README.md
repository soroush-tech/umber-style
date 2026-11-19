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

## Token modes

Each token of the theme is written in one of four modes:

| Mode        | In a rule                   | Declared by a theme class | Value in a style function           |
| ----------- | --------------------------- | ------------------------- | ----------------------------------- |
| `variable`  | `var(--name)`               | yes                       | the reference                       |
| `reference` | `var(--name, <base value>)` | yes                       | the reference, with a fallback      |
| `inline`    | the real value              | no                        | the real value of the nearest theme |
| `raw`       | never written by the engine | no                        | the real value of the nearest theme |

`variable` is the default. A `reference` token works with no theme class on any ancestor, because the
fallback is the value of the base theme; a theme class that declares it still overrides it, a nested
theme included. `inline` writes the real value into the rule, so a theme that changes it makes another
class (a number is written as the serializer writes any number: `px` for a length property, none for
`zIndex`). `raw` is for what is not a CSS value at all (breakpoints, component settings, functions).

The `modes` option (of `createStyle`, `configure` and `createEngine`) gives the mode by dotted theme
path. The most specific path wins: a path on a leaf beats one on its parent, which beats the top-level
key. `rawKeys` still works and means `raw` for those top-level keys; an entry in `modes` beats it.
Without options `breakpoints` and `components` are `raw` and everything else is `variable`.

```ts
import { createStyle } from 'umber-style/react'

const { styled } = createStyle(theme, {
  modes: {
    zIndex: 'inline',
    'transitions.duration': 'variable',
    'palette.primary': 'reference',
  },
})

const Modal = styled('div')(({ theme }) => ({
  zIndex: theme.zIndex.modal, // 100
  color: theme.palette.primary, // var(--css-palette-primary, #0b57d0)
  transitionDuration: theme.transitions.duration.short, // var(--css-transitions-duration-short)
}))
```

The class of `Modal` is `.x{z-index:100;color:var(--css-palette-primary, #0b57d0);transition-duration:var(--css-transitions-duration-short);}`.
Arithmetic helpers (`add`, `multiply`, and the others) treat `var(--x, 8px)` as one opaque value, as
they do `var(--x)`.

## Only used variables

A theme class does not declare every token. The engine scans each rule it inserts for `var(--name`
(with or without a fallback, nested fallbacks included, in one pass over the text) and keeps the set
of used names in the cache. A theme class declares the used names it has a value for, and nothing else.

- A token whose value refers to another variable (`var(--css-palette-blue)`, or a value that contains
  one) makes that variable used too, to any depth.
- `alwaysDeclare: ['space', 'palette.text']` lists theme paths (a top-level key or a dotted path) whose
  variables are always declared, for code outside the engine that reads them, such as an app
  stylesheet. A variable that only such code uses must be listed, or it is not declared.
- `hasPruning: false` (an option of the engine and of `createCache`) turns it off: every theme class
  declares every token, as before.
- The name of a theme class is the hash of all the declarations of its theme, so it does not change
  as more variables come into use.
- A theme class that nothing uses yet still exists and writes no rule (with `colorScheme` it writes
  the `color-scheme` rule only).

`cache.extract()` and `createStyleTag` give each theme class as one rule with the used tokens. In the
browser the rules come in over time: when a rule first uses a variable, one rule declaring the new
variables of that insert is appended for each theme class that has them. All of it is in the
`<prefix>-theme` layer, so the order in which theme rules arrive does not change what wins between
layers; two theme classes on one element are decided by the order they were written in.

A page that was extracted on the server and hydrated does not repeat a declaration and loses none:
`data-ids` lists the used variables too, and a theme class that the server sent is taken to have
those and no more.

In the server-components build each `<style href precedence>` is sent before the elements below it
render, so a provider cannot know which variables they use. It sends every variable of its theme
class, as before (`cache.getFullRules`). Pruning is on in that engine's cache, but only the classic
server render and the browser are smaller.

## Color fallbacks

`alpha(color, opacity)` returns the color at an opacity (0 to 1). A browser without `color-mix()`
would drop the declaration and leave the property unset, so the engine writes two declarations when
the result is the whole value of a property: a fallback first, then the `color-mix()` value. A browser
that does not know `color-mix()` keeps the first.

```ts
styled('div')(({ theme }) => ({
  background: alpha(theme.palette.primary, 0.1),
  borderColor: alpha('#1b5fd1', 0.5),
}))
```

```css
background: var(--css-palette-primary);
background: color-mix(in srgb, var(--css-palette-primary) 10%, transparent);
border-color: rgba(27, 95, 209, 0.5);
border-color: color-mix(in srgb, #1b5fd1 50%, transparent);
```

- The fallback of a literal the engine can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and
  `rgba()` with numbers, comma or space syntax) is that color with the opacity applied, as
  `rgba(r, g, b, a)`; an alpha the color already has is multiplied. The fallback of anything else (a
  token reference, a named color, `hsl()`) is the color itself at full opacity: a solid color is
  better than none.
- `opacity` outside 0 to 1 (or `NaN`) throws a `RangeError`; `1` returns the color itself, `0` returns
  `transparent`.
- The result for a value between 0 and 1 is a small frozen object (`AlphaColor`, with `fallback` and
  `value`), not a string, so that the serializer can tell it from text. As text (`String(x)`, a
  template literal) it is the `color-mix()` form, so `` `1px solid ${alpha(c, 0.5)}` `` is valid CSS. A
  fallback is only written when the result is the whole value of a property (or an item of a list);
  inside a longer string there is none. In a custom property (`'--tint': alpha(...)`) there is none
  either, because a custom property takes any text and a fallback would always win. `1` and `0` give
  plain strings. The arithmetic helpers throw a `TypeError` for an `AlphaColor`.
- `alpha` knows no engine, so the switch is in the serializer: `hasColorFallbacks: false` (an option of
  the engine and of `createCache`, default `true`) makes it write the `color-mix()` value alone, as
  before. A cache that is given to the engine keeps its own setting.
- A token that appears only inside `alpha()` is used: it is in both declarations, so the theme class
  declares it.
- On React Native `alpha` returns an `rgba()` string for `#rgb` and `#rrggbb` and the color unchanged
  for anything else; it is not affected.

## Animating tokens

A CSS variable has no type, so the browser cannot interpolate it. Registering a token writes an
`@property` rule that gives its variable a type; then the variable itself can be transitioned.

```ts
const { styled } = createStyle(theme, {
  registered: { palette: true, 'space.1': '<length>', 'palette.mode': '*' },
})
```

`registered` is keyed by dotted theme path like `modes` (the most specific path wins; a top-level key
such as `palette` covers everything under it). The value is `true`, to infer the syntax from the base
theme value, or one of `'<color>'`, `'<length>'`, `'<number>'`, `'<percentage>'`,
`'<length-percentage>'`, `'<angle>'`, `'<time>'` and `'*'`. Only `variable` and `reference` tokens have
a variable; the others are skipped. A key that matches no token is ignored.

| Base value                                                    | Inferred syntax |
| ------------------------------------------------------------- | --------------- |
| a number under a length key (`space`, `sizes`, ...), or `8px` | `<length>`      |
| any other number, or a numeric string                         | `<number>`      |
| `50%`                                                         | `<percentage>`  |
| `150ms`, `1s`                                                 | `<time>`        |
| `45deg`, `0.5turn`                                            | `<angle>`       |
| `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `transparent`   | `<color>`       |
| anything else                                                 | a `TypeError`   |

Named colors (`red`) are not recognized in inference; give `'<color>'` for them. A token that cannot
be inferred, a syntax that is not in the list, a value that is not of its syntax, and a value that
cannot be an initial value (see below) all throw a `TypeError` that names the theme path when the
engine is created. Register such a token as `'*'`, or not at all.

```css
@property --css-palette-primary {
  syntax: '<color>';
  inherits: true;
  initial-value: #0b57d0;
}
```

- The initial value is the base theme value, with `px` as a theme class declares it. A non-universal
  syntax needs an initial value that does not depend on the element, so `var()`, `env()`, `attr()`,
  `currentcolor`, font-relative units (`em`, `rem`, `ch`, ...) and viewport units are rejected. The
  universal syntax `*` has no initial value. A reference token registers its base value, not the
  `var(--x, fallback)` text.
- `inherits` is always `true`. A nested theme sets the variable on its wrapper and everything inside
  must see it; with `false` a descendant would get the initial value. The cost: every registered
  variable is an inherited property that the browser treats as typed, and a change to one on a wrapper
  restyles the subtree like any inherited property. Register the tokens you animate, not the whole
  theme, on a large page.
- The rule is written once, outside every cascade layer: `@property` is a registry of the document,
  not a style that cascades, so a layer has nothing to order, and its use inside `@layer` is not
  something the engine relies on. It comes after the layer order statement; its position among the
  other rules does not matter. In the server-components build it is sent in the element of the theme
  class (every registered variable that theme declares), after the order statement and before the rule.
- With pruning, a registered token that nothing uses has no rule; the first rule that uses it brings
  it. A classic server render marks the rules it sent in `data-ids`, and the browser writes none
  again. If `setTheme` gives a base theme with another value, the new rule is appended and, being
  last, wins.

What is true about animating a switch of theme class:

- `transition: 'background-color 200ms'` on a component whose `background-color` is `var(--x)`
  animates when a different theme class applies above it and changes `--x`: the computed value of the
  real property changes. This does not need registration (by reasoning from the specification, not
  checked in a browser here).
- What registration adds is a variable that can be transitioned itself: put
  `transition: '--css-palette-primary 200ms'` on the element that a theme class is on, and every
  descendant sees the interpolated value, also where it is used in a place with no interpolation of its
  own (inside a gradient, a `calc()`, a shadow).
- Verified here: the rule text and where it is written, in tests. jsdom accepts `@property` in
  `insertRule`, keeps it as a property rule, and computes a registered `<color>` variable (it comes back
  as `rgb(...)`, and a descendant gets the initial value when `inherits` is `false`), so the nested
  theme test fails for `inherits: false`. jsdom runs no transitions: nothing about the animation itself
  is verified.
- A nested theme that gives a registered token a value of another type (`10px` for a `<color>`) is a
  declaration the browser ignores, so the value of an outer theme shows through.

## Supported browsers

What the engine writes needs custom properties, and cascade layers (Chrome 99, Firefox 97, Safari
15.4, all of 2022) unless `hasLayers: false`. `color-mix()` (Chrome 111, Firefox 113, Safari 16.2) is
optional: with color fallbacks (the default) a browser without it shows the fallback color.
`@property` (Chrome 85, Safari 16.4, Firefox 128) is only written for registered tokens, and a browser
that does not know it ignores the rule: the token works, it only does not animate.

So with the defaults the floor is a 2022 browser. With `hasLayers: false` the floor is a browser with
custom properties and `display: contents` (the scope wrapper), and colors degrade to their fallbacks.
That second claim rests on the specifications and on the output of the engine; it was not run in an old
browser.
