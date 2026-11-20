# Writing styles

After this page you can make styled components with `styled`: label them, compute styles from props and the theme, control which props reach the element, give the element a class of your own, change the element, and build on another styled component.

The examples use the React binding. Vue's `styled` takes attributes instead of props and `class` instead of `className`: see [Vue](vue.md). React Native's `styled` takes components only: see [React Native](react-native.md).

## The shape of `styled`

```tsx
import { createStyle } from '@umber-style/react'

const theme = {
  palette: { primary: '#1b5fd1', onPrimary: '#ffffff', text: '#1a1a1a' },
  space: [0, 4, 8, 16],
  breakpoints: ['600px', '900px'],
}

const { styled, ThemeProvider } = createStyle(theme, { prefix: 'umber' })

const Card = styled('div', { name: 'Card' })({ padding: 16, borderRadius: 8 })

const CardHeader = styled('div', { name: 'Card', slot: 'header' })({ fontWeight: 600 })

const Badge = styled('span', {
  name: 'Badge',
  shouldForwardProp: (prop) => prop !== 'tone',
})<{ tone?: 'primary' | 'plain' }>(({ theme, tone }) => ({
  color: tone === 'primary' ? theme.palette.primary : theme.palette.text,
}))

const Row = styled('div', { name: 'Row' })(
  { display: 'flex', gap: 8 },
  ({ theme }) => ({ padding: theme.space[2] }),
  { '@media (min-width: 600px)': { gap: 16 }, '&:hover': { opacity: 0.9 } }
)

const Button = styled('button', { name: 'Button' })(({ theme }) => ({
  backgroundColor: theme.palette.primary,
  color: theme.palette.onPrimary,
}))
const WideButton = styled(Button, { name: 'WideButton' })({ width: '100%' })

const App = () => (
  <ThemeProvider theme={theme}>
    <Card as="section">
      <CardHeader>Title</CardHeader>
      <Badge tone="primary">new</Badge>
      <Row />
      <WideButton>Save</WideButton>
    </Card>
  </ThemeProvider>
)
```

`styled(tag, options)` returns a function that takes styles and returns a component. The rendered markup:

```html
<section class="umber-card-root-19c1q5u">
  <div class="umber-card-header-15j3uve">Title</div>
  <span class="umber-badge-root-n8ncc0">new</span>
  <div class="umber-row-root-1sgg100"></div>
  <button class="umber-wide-button-root-1r6qi7r">Save</button>
</section>
```

The provider is the outermost one: it renders no element, and its theme is declared on `:root`.

## Options

`styled(tag, options)` takes these options. `shouldForwardProp` is the only one the React Native binding uses; it ignores `name` and `slot`, and `target` is web only.

| Option              | Type                        | Default   | Effect                                                               |
| ------------------- | --------------------------- | --------- | -------------------------------------------------------------------- |
| `name`              | `string`                    | none      | The component's name. With it, the class is labelled `<name>-<slot>` |
| `slot`              | `string`                    | `root`    | The part of the component this style is for. Used in the label       |
| `shouldForwardProp` | `(prop: string) => boolean` | see below | Decides which props reach a string tag                               |
| `target`            | `string`                    | none      | A class of your own that the element always has: see below           |

## Tag shorthands

`styled.div(...styles)` is `styled('div')(...styles)`, for every HTML and SVG tag, typed as the tag (`styled.button` takes the props of a `button`). They take no options: write `styled('div', options)` for those. The shorthands are made when they are first read, not up front, and exist in the client build, the server components build, Vue, and the default style (`import { styled } from '@umber-style/react'`).

```tsx
const Box = styled.div<{ tone?: string }>(({ tone }) => ({ color: tone }))
const Icon = styled.svg({ fill: 'red' })
```

`@umber-style/styled` has the same `styled` of the default style as its default export, for code that imports it that way: `import styled from '@umber-style/styled'`. Under the `react-server` condition it is the `styled` of the server build.

## Name and slot labels

A label puts the component's name in its class, so the developer tools show `umber-card-header-15j3uve` and not `umber-15j3uve`. The label is `name-slot` in kebab-case: `ButtonBase` with the default slot is `button-base-root`. Without a `name` there is no label.

The same name can be used with different slots for the parts of one component, as `Card` and `CardHeader` do above. The label is not unique: it never decides which rule applies, only what the class is called.

A style can carry its own `label` key. `name` and `slot` write one for you.

## Object styles and function styles

`styled(tag)(...styles)` takes any number of styles. Each is an object or a function:

- An object is used as it is. A component made only of objects reads no context at run time, and its class is computed once.
- A function receives the component's props and `theme`, and returns an object, or `null`, `undefined` or `false` for nothing. A function that reads only `theme` is worked out once for each theme (it is part of the base, below). One that reads a prop runs on each render. Equal results give the same class, so nothing grows.

`theme` in a function style is the theme as references: a token is a `var(--name)` string, and everything that is not a token (breakpoints, your own functions) is its real value from the nearest provider. See [Themes](themes.md). A `theme` prop passed to the component is not forwarded to the element and does not replace this `theme`.

Styles merge in order, and a later key wins. In `Row`, none of the three styles reads a prop, so they become one class: `display: flex`, then `padding`, then the media rule and hover rule.

## The base and the props part

The base is the leading part of a component's styles that does not depend on props; it may use theme tokens. It is one class, written once. The props part is everything from the first style that depends on props, and gives one class for each distinct result:

```tsx
const Flex = styled('div', { name: 'Flex' })<{ gap?: number }>(
  { display: 'flex', minWidth: 0 },
  ({ theme }) => ({ color: theme.palette.text }),
  ({ gap }) => ({ gap }),
  { boxSizing: 'border-box' }
)
```

Here the base is `display`, `min-width` and `color` (the function reads only `theme`). The props part is the `gap` function and the `boxSizing` object after it: `boxSizing` does not depend on props, but it comes after a style that does, and it must stay after it. An element is `<div class="umber-flex-root-... umber-flex-root-...">`: the base, then the props class.

- A style depends on props when it is a function that reads any key of its argument other than `theme`, spreads or lists it (`{ ...props }`, `Object.keys(props)`, `'x' in props`), or is a parser that reads props by key, such as `space` from `@soroush.tech/styled-system`.
- A component made only of objects, or of objects and functions that read only `theme`, has no props part: one class, as before.
- A component whose first style depends on props has no base class.
- `hasBaseClass: false` (see [Options reference](options.md)) writes one class for the whole list, as before the split existed.
- With `hasLayers: false`, a component that is given something from outside (`style`, `className`) merges everything into one class, as before: without layers there is no order between classes to rely on.

Give a function the type of your props with the type argument, as `Badge` does: `styled('span')<{ tone?: 'primary' | 'plain' }>(...)`.

## Which props reach the element

`as`, `theme`, `className` and `style` are the component's own and never reach the element. Of the other props, a string tag such as `'span'` receives by default only:

- the attributes of HTML and SVG, by the names React gives them (`id`, `title`, `type`, `disabled`, `tabIndex`, `htmlFor`, `viewBox`, `strokeWidth`, `xlinkHref` and the rest);
- `data-*` and `aria-*` attributes, and event handlers (`onClick`, `onPointerDownCapture`: `on` followed by a capital letter);
- React's own props: `children`, `ref`, `key`, `dangerouslySetInnerHTML`, `defaultValue`, `defaultChecked`, `suppressHydrationWarning`, `suppressContentEditableWarning`.

So a prop that only the styles read stays off the element:

```tsx
const Button = styled('button')<{ variant?: string; isActive?: boolean }>({ color: 'red' })
const go = () => undefined

const App = () => (
  <Button variant="filled" isActive type="submit" data-test="b" aria-label="go" onClick={go} />
)
```

renders `<button type="submit" data-test="b" aria-label="go" class="...">` with the click handler, and neither `variant` nor `isActive`. A custom element (a tag with a hyphen, `'my-element'`) receives every prop, because its attributes are its own. A component (a tag that is not a string) receives every prop but the four.

`shouldForwardProp` replaces that default for string tags: with it, a prop reaches the element exactly when it returns `true`. In `Badge` above, `(prop) => prop !== 'tone'` keeps `tone` off and forwards everything else, an unknown attribute included.

The list of HTML and SVG attributes adds about 3 KB to the React binding, minified (1.7 KB gzipped). The Vue binding has no default filter: see [Vue](vue.md).

The filter is applied to the element that is finally rendered: if you change the element with `as`, a filter is only used when the new element is a string.

## `target`

`target` gives the element a class of your own, after the engine's classes: a stable name that a parent's selector, a test or a tool can find, whatever the hash of the styles is. It is not a style and has no rule. A component that wraps another keeps the wrapped component's `target` and adds its own:

```tsx
const Card = styled('div', { name: 'Card', target: 'card' })({ color: 'red' })
const WideCard = styled(Card, { target: 'wide' })({ width: '100%' })
```

`<Card className="mine" />` renders `<div class="umber-card-root-... mine card">`, and `<WideCard />` renders `<div class="umber-card-root-... card wide">`.

## `as`

The `as` prop renders another element or component in place of the tag:

```tsx
<Card as="section">...</Card>
```

The class is the same. `as` itself is never forwarded.

## Wrapping a styled component

`styled(Button)(more)` does not render a `Button` inside a new element. It makes one component with the styles of `Button` first and yours after, rendered as the same element with one class. In the example, `WideButton` is one `button` with `background-color`, `color` and `width`. The label is the outer one (`wide-button-root`). `shouldForwardProp` is inherited from the wrapped component unless you give one.

Wrapping any other component works, and then the styles go to that component as a `className`:

```tsx
const Link = ({ className, children }: { className?: string; children: string }) => (
  <a className={className}>{children}</a>
)
const BlueLink = styled(Link)({ color: 'blue' })
```

The component must accept `className` and put it on an element, as it must for any styling that uses classes.

Wrapping a component that has a base class keeps that base. The wrapper's styles come after the styles of the wrapped component, and the split is made on the whole list:

- the wrapped component has props-dependent styles: the wrapper's element carries the same base class, and the rest of the list (the props part of the wrapped component, then all of the wrapper's styles) is its props part;
- the wrapped component has none (it is all base) and the wrapper's styles start with a function that reads props: the element carries the base class of the wrapped component as it is, and the wrapper's styles are the props part;
- the wrapped component has none and the wrapper's styles start with plain objects: the plain objects are added to the base, which is then a new, larger class under the wrapper's label. The declarations of the wrapped component are written again in it. The other choice, keeping the base of the wrapped component and adding the objects as a second fixed class, would write fewer declarations once, but it would put them in the props part, so that they would be repeated in every distinct props class. A wrapper without any props-dependent style also keeps the single class it always had.

## Animations and styles outside a class

A style names an animation that `keyframes` made, inside the `animation` shorthand or as `animationName`; the `@keyframes` rule is written once, with the first class that uses it. Styles for `body`, a reset or a `@font-face` are not a component's: write them with `globalStyles` and render them with `Global`. Both are in [Animations and global styles](animations-and-global-styles.md).

```tsx
const { styled, keyframes } = createStyle(theme, { prefix: 'umber' })

const pulse = keyframes({ '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, { label: 'pulse' })

const Dot = styled('span', { name: 'Dot' })({
  animationName: pulse,
  animationDuration: 800,
  animationIterationCount: 'infinite',
})
```

A number for `animationDuration` (and `animationDelay`, `transitionDuration`, `transitionDelay`) is in milliseconds: `800` is `800ms`.

## Merging with `className` and `style`

A `className` you give a styled component is kept, and any class the engine made in it is merged into the component's overrides. The `style` prop takes sheet entries and objects and turns them into a class. Both are covered in [Style sheets and the style prop](style-sheets.md) and [Cascade layers and overrides](cascade-layers.md).

## Limits

- A key built at run time (a media query made from a breakpoint, for example) written directly in a web style object is a type error: write it with `at(key, style)`. See [Typed styles](typed-styles.md).
- The default filter knows the attributes of HTML and SVG under their React names. A lowercase or hyphenated spelling (`tabindex`, `stroke-width`) and an attribute that is not in the specifications (a vendor attribute, a new one) do not reach the element unless `shouldForwardProp` lets them, and a prop of your own that has the name of an attribute (`color`, `size`, `label`, `width`) does reach it.
- The shorthands are typed for the tags of React's JSX types (React) and Vue's (Vue). At run time any name that starts with a lowercase letter is made into a tag, except `then`.
- A function style that reads props runs on every render of its component. Keep it cheap. One that reads only `theme` runs once for each theme object.
- Style functions must be pure: the base keeps the first result of a function that read no prop, for a theme. A function that reads a prop only inside something it returns (a callback) is not seen reading it.
