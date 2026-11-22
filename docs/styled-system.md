# Working with `@soroush.tech/styled-system`

After this page you can use the parsers and variants of `@soroush.tech/styled-system` as style functions, keep their props off the element, and know the cases that do not work yet.

A parser from `@soroush.tech/styled-system` is a function of props and theme that returns a style object. That is the shape of a function style, so `styled` takes it as it is, with no adapter:

```tsx
import { createStyle } from '@umber-style/react'
import { space, type SpaceProps } from '@soroush.tech/styled-system/space'
import { variant } from '@soroush.tech/styled-system/variant'
import shouldForwardProp from '@soroush.tech/styled-system/should-forward-prop'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider, engine } = createStyle(theme, { prefix: 'umber' })

const Box = styled('div', { shouldForwardProp })<SpaceProps>(space)

const { palette } = engine.refs
const kind = variant({
  prop: 'kind',
  variants: {
    filled: { backgroundColor: palette.primary, color: palette.onPrimary },
    outlined: { color: palette.primary, border: `1px solid ${palette.primary}` },
  },
})
const forward = (prop: string) => prop !== 'kind' && shouldForwardProp(prop)
const Button = styled('button', { name: 'Button', shouldForwardProp: forward })(kind, space)

const App = () => (
  <ThemeProvider theme={theme}>
    <Box p={2} mx={3} />
    <Box p={[1, 2]} />
    <Button kind="filled" px={2}>
      Save
    </Button>
  </ThemeProvider>
)
```

The rules are:

```text
.umber-152pv3f{padding:var(--umber-space-2);margin-left:var(--umber-space-3);margin-right:var(--umber-space-3);}
.umber-klja4j{padding:var(--umber-space-1);}
@media (width >= 600px){.umber-klja4j{padding:var(--umber-space-2);}}
.umber-button-root-iry4x2{background-color:var(--umber-palette-primary);color:var(--umber-palette-on-primary);padding-left:var(--umber-space-2);padding-right:var(--umber-space-2);}
```

What happens:

- **Space.** `p={2}` looks up `theme.space[2]` in the theme view, which holds references, so the CSS has `var(--umber-space-2)`. The class is the same under every theme.
- **Responsive arrays.** `p={[1, 2]}` uses `theme.breakpoints`. A breakpoint is a raw value, so it is written into the media rule, and a nested provider with other breakpoints gets its own media rule and its own class.
- **Responsive objects.** `p={{ _: 1, tablet: 2 }}` uses named breakpoints when `breakpoints` is an object such as `{ tablet: 700 }`.
- **Parsers made with `system()`.** A parser such as `system({ color: { property: 'color', scale: 'palette' } })` reads a scale of the theme, so `color="primary"` becomes `var(--umber-palette-primary)`.
- **Variants.** `variant({ prop, variants })` selects a style by prop. The styles may name theme values, or use references from `engine.refs`, as above. `variant({ scale: 'buttons', prop: 'kind' })` reads the variants from a scale of the theme. An unknown variant gives a style with no declaration, and so no class.
- **Prop filtering.** The `shouldForwardProp` of the package keeps system props (`p`, `mx` and the rest) off the element. It does not know your own variant prop: `kind="filled"` would reach the `button` as an attribute, so `forward` above filters it too.
- **Types.** A parser is typed loosely, so `styled` takes it without a cast. An object next to a parser is still checked as a style; with the strict switch of [Typed styles](typed-styles.md#the-default-types-and-the-strict-switch), `styled('div')(space, { backgroudColor: 'red' })` is a type error.

The package is a development dependency of the repository's tests, not a dependency of any `@umber-style` package. Install it yourself if you use it.

## On React Native

The parsers run with `styled` of `@umber-style/react-native` too, and give what the web gives, in numbers (`packages/react-native/src/styledSystem.test.tsx`, over a theme written for the web, with `space: ['0px', '4px', '8px', '16px']` and `breakpoints: ['600px', '900px']`):

| Props                               | What the component gets                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `p={2} mx={3} m={-2}` with `space`  | `[{ margin: -8, marginLeft: 16, marginRight: 16, padding: 8 }]`: the token is a number, so `-2` is `-8` |
| `p={[1, 2, 3]}` with `space`        | `[{ padding: 4 }]` in a window 400 wide, `[{ padding: 8 }]` at 700, `[{ padding: 16 }]` at 1000         |
| `color="primary"` with a `system()` | `{ color: '#1b5fd1' }`, the value of the `palette` scale                                                |
| `kind="filled"` with a `variant`    | `{ backgroundColor: '#d11b5f', padding: 8 }`: the variant's `brand` from `colors`, its `2` from `space` |

A responsive array is written by the parser as a media key in the range form (`@media (width >= 600px)`), which the binding evaluates against the window (see [Media keys on React Native](writing-styles.md#media-keys-on-react-native)): the component renders again when the window crosses a breakpoint. A parser that returns nothing for the props it got is an empty object in the style array (`[{ color: '#1b5fd1' }, {}]`). The props of the parsers reach the native component unless `shouldForwardProp` keeps them off, as on the web: `styled(View, { shouldForwardProp })` with the filter of the package.

## Known gaps

- **Negative space.** `m={-2}` makes `margin:-var(--umber-space-2)`, which is not valid CSS. The parser turns a negative key into `-` followed by the scale value, and the value is a `var()` here. The valid rule would be `calc(var(--umber-space-2) * -1)`, which is what `negate` writes. Use a style with `negate` for a negative margin.
- **Numbers in a variant scale.** A number in a scale that is not under a length key (`space`, `sizes`, `radii`, `fontSizes`, `borderWidths`) is declared without `px`. With `buttons: { primary: { padding: 8 } }` the variable is `--umber-buttons-primary-padding:8`, and `padding: var(--umber-buttons-primary-padding)` is a unitless number. Add the key to `lengthKeys`, or write the value as a string with its unit.
- **Media queries.** The responsive output uses the range syntax (`@media (width >= 600px)`). That is what the package writes, not what the engine writes, and it needs a browser that supports it: the versions are to be confirmed.
- **Other platforms.** The examples were run with the React binding, and `space`, `system()` and `variant` with the React Native binding (above). The parsers were not tried with the Vue binding.

These gaps are recorded in `packages/react/src/styledSystem.test.tsx`, and what React Native gives in `packages/react-native/src/styledSystem.test.tsx`.

## Limits

- `variant` with references from `engine.refs` needs the engine, so it is made from `createStyle`'s result, not from the direct imports (use `getEngine().refs` there).
- Everything above was run against `@soroush.tech/styled-system` `^6.0.1`.
