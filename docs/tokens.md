# Tokens

After this page you can do arithmetic on tokens, make a colour at an opacity with a fallback, choose how each token is written, animate a theme switch, and control which variables a theme class declares.

A token is a value of your theme that has a CSS variable: `theme.space[2]` is `var(--umber-space-2)` on the web. The examples use the engine directly (`createEngine`); in a binding the same options go to `createStyle` or `configure`, and the helpers are the same.

## Arithmetic on tokens

On the web a token is a reference string, so JavaScript cannot add to it: `theme.space[2] * 2` is not a number. `multiply`, `divide`, `add`, `subtract` and `negate` return CSS that the browser computes. Two numbers are computed directly.

```ts
import { add, createEngine, multiply, negate } from '@umber-style/core'

const theme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
}
const engine = createEngine(theme, { prefix: 'umber' })

const { space } = engine.refs
const className = engine.css({
  padding: multiply(space[1], 2),
  marginLeft: negate(space[2]),
  width: add(space[3], 4),
})
```

The rule is:

```text
.umber-3yq4zs{padding:calc(var(--umber-space-1) * 2);margin-left:calc(var(--umber-space-2) * -1);width:calc(var(--umber-space-3) + 4px);}
```

| Call                                    | Result on the web                    |
| --------------------------------------- | ------------------------------------ |
| `multiply(8, 2)`                        | `16`                                 |
| `multiply('var(--umber-space-2)', 2)`   | `'calc(var(--umber-space-2) * 2)'`   |
| `multiply('8px', 2)`                    | `'16px'` (a literal length computes) |
| `multiply('50%', 2)`                    | `'100%'`                             |
| `multiply(x, 1)`, `divide(x, 1)`        | `x`                                  |
| `multiply(x, 0)`                        | `0`                                  |
| `divide('var(--umber-space-2)', 2)`     | `'calc(var(--umber-space-2) / 2)'`   |
| `divide(x, 0)`                          | throws a `RangeError`                |
| `add(4, 4)`                             | `8`                                  |
| `add('var(--umber-space-2)', 4)`        | `'calc(var(--umber-space-2) + 4px)'` |
| `add('8px', '4px')`                     | `'12px'` (same unit only)            |
| `add('8px', '1em')`                     | `'calc(8px + 1em)'`                  |
| `add('50%', '10%')`                     | `'60%'`                              |
| `add('50%', 4)`                         | `'calc(50% + 4px)'`                  |
| `add(x)`, `add(x, 0)`, `subtract(x, 0)` | `x`                                  |
| `subtract('var(--umber-space-2)', 4)`   | `'calc(var(--umber-space-2) - 4px)'` |
| `negate('var(--umber-space-2)')`        | `'calc(var(--umber-space-2) * -1)'`  |
| `add(multiply(a, 2), b)`                | `'calc((a * 2) + b)'`                |

A number next to a string in `add` and `subtract` is a length in `px`. The second argument of `multiply` and `divide` is always a unitless factor. An operand that is already a `calc(...)` goes in parentheses, so a calc is never nested inside a calc. A factor or a number that is not finite throws a `RangeError`; an operand that is neither a string nor a number throws a `TypeError`. The result is typed `number` when every argument is a number, otherwise `string | number`.

### On React Native

The same names compute real numbers, because a token there is the number itself. They are exported by `@umber-style/react-native` and by `umber-style/react` (which is the one name that works on both platforms).

| Call                          | On the web                     | On React Native                                       |
| ----------------------------- | ------------------------------ | ----------------------------------------------------- |
| `multiply(theme.space[1], 2)` | `'calc(var(--space-1) * 2)'`   | `8` (for a token of 4)                                |
| `negate(theme.space[2])`      | `'calc(var(--space-2) * -1)'`  | `-8`                                                  |
| `divide(theme.space[2], 2)`   | `'calc(var(--space-2) / 2)'`   | `4`                                                   |
| `add(theme.space[2], 4)`      | `'calc(var(--space-2) + 4px)'` | `12`                                                  |
| `subtract(theme.space[2], 4)` | `'calc(var(--space-2) - 4px)'` | `4`                                                   |
| `multiply('8px', 2)`          | `'16px'`                       | `16` (`px` or no unit is a number)                    |
| `multiply('50%', 2)`          | `'100%'`                       | `'100%'`                                              |
| `add('50%', '10%')`           | `'60%'`                        | `'60%'`                                               |
| `add('50%', 4)`               | `'calc(50% + 4px)'`            | throws a `TypeError`                                  |
| `multiply('var(--x)', 2)`     | `'calc(var(--x) * 2)'`         | throws a `TypeError` (names the helper and the value) |
| `add('8px', '1em')`           | `'calc(8px + 1em)'`            | throws a `TypeError`                                  |
| `multiply(x, 1)`, `add(x, 0)` | `x`                            | `x` as a number                                       |
| `divide(x, 0)`                | throws a `RangeError`          | throws a `RangeError`                                 |

On React Native a percentage stays a percentage for `multiply`, `divide` and `negate`, and for `add` and `subtract` when every operand is one. Anything that cannot be computed (a `var(...)` string, mixed units) throws, because a silently wrong value would be worse. The shared types take numbers and percentages only, so a reference string or a length with a unit is a type error in shared code: write those in the `web` part.

In shared code (`umber-style/react`) a token is typed as the number it is on React Native, so the result is typed `number` there too.

Every binding exports them, Vue's included, and so does `@umber-style/core`.

### String forms of token maths

Code written for real values often builds strings from tokens. With a token the text is a reference, and three such forms are not valid CSS (but see the contrived case in [Limits](#limits)): the browser drops the declaration. `hasValueRepair: true` (an option of the engine and of the cache, default `false`) rewrites them in each value:

| Written                                      | The text the engine sees | Written out as                                                                                                                                 |
| -------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `` `${color}1F` `` (two hex digits of alpha) | `var(--x)1F`             | what `alpha(color, 0x1F / 255)` writes: `color-mix(in srgb, var(--x) 12.16%, transparent)`. `ff` gives `var(--x)` and `00` gives `transparent` |
| `` `-${space}` ``                            | `-var(--x)`              | what `negate(space)` writes: `calc(var(--x) * -1)`                                                                                             |
| `` `${duration}ms` ``, `` `${duration}s` ``  | `var(--x)ms`             | `calc(var(--x) * 1ms)`, `calc(var(--x) * 1s)`                                                                                                  |

```ts
const theme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
  transitions: { duration: { short: 150 } },
}
const engine = createEngine(theme, { prefix: 'umber', hasValueRepair: true })

const { palette, space, transitions } = engine.refs
const className = engine.css({
  background: `${palette.primary}1F`,
  border: `1px solid ${palette.primary}80`,
  marginLeft: `-${space[2]}`,
  transition: `opacity ${transitions.duration.short}ms`,
})
```

```text
.umber-jsrgfl{background:color-mix(in srgb, var(--umber-palette-primary) 12.16%, transparent);border:1px solid color-mix(in srgb, var(--umber-palette-primary) 50.2%, transparent);margin-left:calc(var(--umber-space-2) * -1);transition:opacity calc(var(--umber-transitions-duration-short) * 1ms);}
```

- A form is rewritten in a value alone and inside a longer value, as many times as it is there, and in each item of a fallback list. A reference with a fallback (`var(--x, 8px)`) is one reference, and the forms inside its fallback are rewritten too. Global rules and the steps of `keyframes` are rewritten as a class is.
- What is left alone: a reference followed by a space, a comma, `)`, `/` or the end of the value; two hex digits or a unit followed by another letter, digit, `-` or `_` (`var(--x)1Fa`, `var(--x)sec`); a minus that is not at the start of the value or after a space, a comma or `(` (`calc(1px - var(--x))` has a space after it); a custom property (a key that starts with `--`), which takes any text; an `alpha()` result, which is valid already.
- The time form needs a variable that holds a number: `150` makes `calc(var(--x) * 1ms)` a time of `150ms`. Length units (`px`, `rem`, `%`) are not rewritten. A number under a `lengthKeys` key is declared with `px` already, so `` `${space[2]}px` `` would be `calc(8px * 1px)`, which is not valid either: write `space[2]` alone, or add the key to `lengthKeys`.
- Without the option nothing is rewritten, and a value costs nothing more. With it, a value that holds no `var(` costs one check.
- The option is part of the stamp of options that a server page carries (`v=1`). It is written only when the option is on, so the stamp of a page without it is the text it was before.

Arithmetic in JavaScript cannot be repaired: `theme.space[2] * 2` and `parseFloat(theme.space[2])` run before the engine sees anything, and a reference is not a number. Use one of the three routes: the helpers above (`multiply(space[2], 2)`), `useTheme()` where JavaScript needs the real value (see [Themes](themes.md)), or a token mode that keeps the real value (`inline` or `raw`, below).

## Colours at an opacity: `alpha`

`alpha(color, opacity)` returns the colour at an opacity from 0 to 1. A browser without `color-mix()` would drop the declaration and leave the property unset, so the engine writes two declarations when the result is the whole value of a property: a fallback first, then the `color-mix()` value. A browser that does not know `color-mix()` keeps the first.

```ts
import { alpha } from '@umber-style/core'

const { palette } = engine.refs
const className = engine.css({
  background: alpha(palette.primary, 0.1),
  borderColor: alpha('#1b5fd1', 0.5),
  border: `1px solid ${alpha('#1b5fd1', 0.5)}`,
})
```

```text
.umber-m6w5hf{background:var(--umber-palette-primary);background:color-mix(in srgb, var(--umber-palette-primary) 10%, transparent);border-color:rgba(27, 95, 209, 0.5);border-color:color-mix(in srgb, #1b5fd1 50%, transparent);border:1px solid color-mix(in srgb, #1b5fd1 50%, transparent);}
```

- The fallback of a literal colour the engine can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, and `rgb()` or `rgba()` with numbers, in comma or space syntax) is that colour with the opacity applied, as `rgba(r, g, b, a)`. An alpha the colour already has is multiplied: `alpha('rgb(10 20 30 / 50%)', 0.5)` falls back to `rgba(10, 20, 30, 0.25)`. The fallback of anything else (a token reference, a named colour, `hsl()`) is the colour itself at full opacity: a solid colour is better than none.
- An `opacity` outside 0 to 1, or `NaN`, throws a `RangeError`. `1` returns the colour itself and `0` returns `transparent`.
- A value between 0 and 1 is a small frozen object (`AlphaColor`, with `fallback` and `value`), not a string, so that the serializer can tell it from text. As text (`String(x)`, a template literal) it is the `color-mix()` form, so `` `1px solid ${alpha(c, 0.5)}` `` is valid CSS. A fallback is only written when the result is the whole value of a property, or an item of a list. Inside a longer string there is none, as in `border` above. In a custom property (`'--tint': alpha(...)`) there is none either, because a custom property takes any text and a fallback would always win. `1` and `0` give plain strings. The arithmetic helpers throw a `TypeError` for an `AlphaColor`.
- `alpha` knows no engine, so the switch is in the serializer: `hasColorFallbacks: false` (an option of the engine and of the cache, default `true`) writes the `color-mix()` value alone. A cache that is given to the engine keeps its own setting.
- A token that appears only inside `alpha()` is used: it is in both declarations, so the theme class declares it.

```ts
const engine = createEngine(theme, { prefix: 'umber', hasColorFallbacks: false })
```

On React Native, `alpha` follows the same rules, and the result is one colour string, because the platform has no `color-mix()` and no fallback pair. It checks its arguments as the web does (a `TypeError` for a colour that is not a string or an opacity that is not a number, a `RangeError` for an opacity outside 0 to 1 or `NaN`), `1` returns the colour and `0` returns `'transparent'`. Between, a colour that the core can read (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` with numbers, with an alpha it already has multiplied) is returned as `rgba(r, g, b, a)`, as in `alpha('#1b5fd1', 0.5)`, which is `'rgba(27, 95, 209, 0.5)'`. Any other colour (a named colour, `hsl()`) is returned as it is: the platform's own value is better than a wrong one.

## Token modes

Each token of the theme is written in one of four modes:

| Mode        | In a rule                   | Declared by a theme class | Value in a style function           |
| ----------- | --------------------------- | ------------------------- | ----------------------------------- |
| `variable`  | `var(--name)`               | yes                       | the reference                       |
| `reference` | `var(--name, <base value>)` | yes                       | the reference, with a fallback      |
| `inline`    | the real value              | no                        | the real value of the nearest theme |
| `raw`       | never written by the engine | no                        | the real value of the nearest theme |

`variable` is the default.

- A `reference` token works with no theme class on any ancestor, because the fallback is the value of the base theme. A theme class that declares it still overrides it, a nested theme included.
- `inline` writes the real value into the rule, so a theme that changes it makes another class. A number is written as the serializer writes any number: `px` for a length property, none for `zIndex`.
- `raw` is for what is not a CSS value at all: breakpoints, component settings, functions.

The `modes` option gives the mode by dotted theme path. The most specific path wins: a path on a leaf beats one on its parent, which beats the top-level key. `rawKeys` means `raw` for those top-level keys and still works; an entry in `modes` beats it.

```ts
const theme = {
  palette: { primary: '#1b5fd1', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
  zIndex: { modal: 100 },
  transitions: { duration: { short: '150ms' } },
  breakpoints: ['600px', '900px'],
}

const engine = createEngine(theme, {
  prefix: 'umber',
  modes: {
    zIndex: 'inline',
    'transitions.duration': 'variable',
    'palette.primary': 'reference',
  },
})

const { zIndex, palette, transitions } = engine.refs
const className = engine.css({
  zIndex: zIndex.modal, // 100
  color: palette.primary, // var(--umber-palette-primary, #1b5fd1)
  transitionDuration: transitions.duration.short, // var(--umber-transitions-duration-short)
})
```

The class is `umber-f8wdob`, and its rule is `z-index:100;color:var(--umber-palette-primary, #1b5fd1);transition-duration:var(--umber-transitions-duration-short);`. The arithmetic helpers treat `var(--x, 8px)` as one opaque value, as they do `var(--x)`.

Two more options decide which tokens are lengths and which are raw by default:

| Option       | Type       | Default                                                    | Effect                                                                                             |
| ------------ | ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rawKeys`    | `string[]` | `['breakpoints', 'components']`                            | Top-level keys that stay real values. A list you give replaces the default list                    |
| `lengthKeys` | `string[]` | `['space', 'sizes', 'radii', 'fontSizes', 'borderWidths']` | Top-level keys whose numbers are lengths, declared with `px`. A list you give replaces the default |

## Only the variables in use

A theme class does not declare every token. The engine scans each rule it inserts for `var(--name` (with or without a fallback, nested fallbacks included, in one pass over the text) and keeps the set of used names in the cache. A theme class declares the used names it has a value for, and nothing else.

```ts
engine.css({ color: engine.refs.palette.primary })
const id = engine.themeId(theme)
```

With the defaults, the theme class of `id` is `.umber-theme-1342wv{--umber-palette-primary:#1b5fd1;}`: one variable, not the whole theme. With `hasPruning: false` it declares all of them: `--umber-palette-primary`, `--umber-palette-text`, `--umber-space-0` to `--umber-space-3`, `--umber-z-index-modal` and `--umber-transitions-duration-short`.

- A token whose value refers to another variable (`var(--umber-palette-blue)`, or a value that contains one) makes that variable used too, to any depth.
- The variables of a global rule and of a `@keyframes` rule are used as those of a class are, when the rule is written; on a server they count for every page. See [Animations and global styles](animations-and-global-styles.md).
- `alwaysDeclare` lists theme paths (a top-level key or a dotted path) whose variables are always declared, for code outside the engine that reads them, such as an app stylesheet. A variable that only such code uses must be listed, or it is not declared:

  ```ts
  const engine = createEngine(theme, { prefix: 'umber', alwaysDeclare: ['palette.text'] })
  ```

  After `engine.css({ color: engine.refs.palette.primary })` the theme class is `.umber-theme-1342wv{--umber-palette-primary:#1b5fd1;--umber-palette-text:#1a1a1a;}`. The class name is the same in all three cases.

- `hasPruning: false` (an option of the engine and of the cache) turns pruning off: every theme class declares every token.

  ```ts
  const engine = createEngine(theme, { prefix: 'umber', hasPruning: false })
  ```

- The name of a theme class is the hash of all the declarations of its theme, so it does not change as more variables come into use.
- A theme class that nothing uses yet still exists and writes no rule. With a `colorScheme` it writes the `color-scheme` rule only.

`cache.extract()` and `createStyleTag` give each theme class as one rule with the used tokens. In the browser the rules come in over time: when a rule first uses a variable, one rule declaring the new variables of that insert is appended for each theme class that has them. All of it is in the `<prefix>-theme` layer, so the order in which theme rules arrive does not change what wins between layers. Two theme classes on one element are decided by the order they were written in.

A page that was extracted on the server and hydrated does not repeat a declaration and loses none: the browser reads the theme rules on the page, takes a theme class that the server sent to declare the variables of that rule and no more, and learns the used variables from the rules of the page. Rules that arrive later (streamed content, a route fetched by the framework) are read as they arrive, so a theme class that only the browser made is completed with the variables they use.

In the server components build each `<style href precedence>` is sent before the elements below it render, so a provider cannot know which variables they use. It sends every variable of its theme class (`cache.getFullRules`). Pruning is on in that engine's cache, but only the classic server render and the browser are smaller. See [Server rendering](server-rendering.md).

## Animating tokens

A CSS variable has no type, so the browser cannot interpolate it. Registering a token writes an `@property` rule that gives its variable a type, and then the variable itself can be transitioned. (To animate a component with steps of your own, see `keyframes` in [Animations and global styles](animations-and-global-styles.md): a token in a step is a variable, and a property that uses it is interpolated without registration.)

```ts
import { createCache, createEngine, createMemorySheet } from '@umber-style/core'

const sheet = createMemorySheet()
const engine = createEngine(theme, {
  prefix: 'umber',
  registered: { palette: true, 'space.1': '<length>' },
  cache: createCache({ prefix: 'umber', sheet }),
})
engine.css({ color: engine.refs.palette.primary, padding: engine.refs.space[1] })
```

`sheet.rules` now holds, after the layer statement and the component rule:

```text
@property --umber-palette-primary{syntax:"<color>";inherits:true;initial-value:#1b5fd1;}
@property --umber-space-1{syntax:"<length>";inherits:true;initial-value:4px;}
```

`registered` is keyed by dotted theme path like `modes`: the most specific path wins, and a top-level key such as `palette` covers everything under it. The value is `true`, to infer the syntax from the base theme value, or one of `'<color>'`, `'<length>'`, `'<number>'`, `'<percentage>'`, `'<length-percentage>'`, `'<angle>'`, `'<time>'` and `'*'`. Only `variable` and `reference` tokens have a variable; the others are skipped. A key that matches no token is ignored.

| Base value                                                    | Inferred syntax |
| ------------------------------------------------------------- | --------------- |
| a number under a length key (`space`, `sizes`, ...), or `8px` | `<length>`      |
| any other number, or a numeric string                         | `<number>`      |
| `50%`                                                         | `<percentage>`  |
| `150ms`, `1s`                                                 | `<time>`        |
| `45deg`, `0.5turn`                                            | `<angle>`       |
| `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `transparent`   | `<color>`       |
| anything else                                                 | a `TypeError`   |

Named colours (`red`) are not recognized in inference: give `'<color>'` for them. A token that cannot be inferred, a syntax that is not in the list, a value that is not of its syntax, and a value that cannot be an initial value all throw a `TypeError` that names the theme path, when the engine is created. Register such a token as `'*'`, or not at all.

- The initial value is the base theme value, with `px` as a theme class declares it. A non-universal syntax needs an initial value that does not depend on the element, so `var()`, `env()`, `attr()`, `currentcolor`, font-relative units (`em`, `rem`, `ch` and so on) and viewport units are rejected. The universal syntax `*` has no initial value. A reference token registers its base value, not the `var(--x, fallback)` text.
- `inherits` is always `true`. A nested theme sets the variable on its wrapper and everything inside must see it; with `false` a descendant would get the initial value. The cost: every registered variable is an inherited property that the browser treats as typed, and a change to one on a wrapper restyles the subtree like any inherited property. Register the tokens you animate, not the whole theme, on a large page.
- The rule is written once, outside every cascade layer: `@property` is a registry of the document, not a style that cascades, so a layer has nothing to order. It comes after the layer order statement, and its position among the other rules does not matter. In the server components build it is sent in the element of the theme class (every registered variable that theme declares), after the order statement and before the rule.
- With pruning, a registered token that nothing uses has no rule; the first rule that uses it brings it. A classic server render sends its rules in the page, and the browser reads them and writes none again. If `setTheme` gives a base theme with another value, the new rule is appended and, being last, wins.

### What this does for a transition

- `transition: 'background-color 200ms'` on a component whose `background-color` is `var(--x)` animates when a different theme class applies above it and changes `--x`: the computed value of the real property changes. This does not need registration. It is reasoned from the specification and was not checked in a browser.
- What registration adds is a variable that can be transitioned itself: put `transition: '--umber-palette-primary 200ms'` on the element that a theme class is on, and every descendant sees the interpolated value, also where it is used in a place with no interpolation of its own (inside a gradient, a `calc()`, a shadow). This is also reasoned and not observed.
- A nested theme that gives a registered token a value of another type (`10px` for a `<color>`) is a declaration the browser ignores, so the value of an outer theme shows through.

What the tests do check: the rule text and where it is written. In jsdom, which accepts `@property` and keeps it as a property rule, a registered `<color>` variable is computed (it comes back as `rgb(...)`) and a registered token still resolves inside a nested theme. jsdom runs no transitions, so nothing about the animation itself is verified.

## Limits

- **Transitions on registered tokens were never observed in a browser.** Both claims above are reasoning from the specification.
- A token mode is chosen once, when the engine is created. Changing `modes` later is not supported: make another engine.
- The arithmetic helpers do not know a variable's value. `multiply('var(--x)', 2)` is a `calc()` that the browser computes, so it cannot be used where a plain number is needed (a `z-index`, for example).
- On React Native, `alpha` cannot mix: a colour it cannot read as a literal (a named colour, `hsl()`) is returned at full opacity, whatever the opacity is.
- `lengthKeys` and `rawKeys` take top-level keys only. For anything deeper use `modes`.
- `hasValueRepair` reads the text, not the value of a variable. A reference followed by two digits is valid in one contrived case, when the variable and the digits read as two items of a list (`flex: var(--grow)10`, where `--grow` is `1`, is `flex: 1 10`); the option rewrites it as alpha all the same. Parentheses inside a quoted string of a fallback are counted as any other. Only `ms` and `s` are rewritten as units.
- Browser versions for `color-mix()` and `@property` are to be confirmed: see [Browser and platform support](browser-support.md).
