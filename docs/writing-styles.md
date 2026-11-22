# Writing styles

After this page you can make styled components with `styled`: label them, compute styles from props and the theme, write them as objects or as CSS text, control which props reach the element, give the element a class of your own, change the element, build on another styled component, and use one as a selector.

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
  <button class="umber-button-root-wide-button-root-1r6qi7r">Save</button>
</section>
```

The provider is the outermost one: it renders no element, and its theme is declared on `:root`.

## Options

`styled(tag, options)` takes these options. `shouldForwardProp` is the only one the React Native binding uses; it ignores `name`, `slot` and `label`, and `target` is web only.

| Option              | Type                        | Default   | Effect                                                               |
| ------------------- | --------------------------- | --------- | -------------------------------------------------------------------- |
| `name`              | `string`                    | none      | The component's name. With it, the class is labelled `<name>-<slot>` |
| `slot`              | `string`                    | `root`    | The part of the component this style is for. Used in the label       |
| `label`             | `string`                    | none      | The label of the class as it is written; it wins over `name`/`slot`  |
| `shouldForwardProp` | `(prop: string) => boolean` | see below | Decides which props reach the element or component that is rendered  |
| `target`            | `string`                    | none      | A class of your own that the element always has: see below           |

## Tag shorthands

`styled.div(...styles)` is `styled('div')(...styles)`, for every HTML and SVG tag, typed as the tag (`styled.button` takes the props of a `button`). They take no options: write `styled('div', options)` for those. The shorthands exist in the client build, the server components build, Vue, the default style (`import { styled } from '@umber-style/react'`) and `createStyle(...).styled`.

Each tag that React types as an element is an own enumerable member of `styled`, a getter that makes the shorthand when it is read. So `Object.assign(wrapper, styled)` copies them, and a wrapper of `styled` has `wrapper.div`. Reading a shorthand of the default style does not use it: `configure` can still be called after the copy. A name that looks like a tag and is not in that list is made when it is read, as before.

```tsx
const wrapper = Object.assign((tag: 'b') => styled(tag), styled)
const Strong = wrapper.b({ fontWeight: 700 })
```

```tsx
const Box = styled.div<{ tone?: string }>(({ tone }) => ({ color: tone }))
const Icon = styled.svg({ fill: 'red' })
```

`@umber-style/styled` has the same `styled` of the default style as its default export, for code that imports it that way: `import styled from '@umber-style/styled'`. Under the `react-server` condition it is the `styled` of the server build. It is a legacy entry for React only: it holds one line, a re-export of the `styled` of `@umber-style/react`, so that code written for a default export changes only the name of the package. New code imports `styled` from `@umber-style/react` and does not need it: the two are the same function, with the same engine, cache and theme.

## Name and slot labels

A label puts the component's name in its class, so the developer tools show `umber-card-header-15j3uve` and not `umber-15j3uve`. The label is `name-slot` in kebab-case: `ButtonBase` with the default slot is `button-base-root`. Without a `name` there is no label.

The same name can be used with different slots for the parts of one component, as `Card` and `CardHeader` do above. The label is not unique: it never decides which rule applies, only what the class is called.

A style can carry its own `label` key. `name` and `slot` write one for you.

The `label` option is a label as it is written, with no kebab-case: `styled('span', { label: 'AlertIcon' })` makes classes `<prefix>-AlertIcon-<hash>`, the base and the props class alike. Given with `name` and `slot`, it wins over them. A label is part of the class name only while the cache has `hasLabels`, which is on by default (see [Options reference](options.md)); without it the class is `<prefix>-<hash>`. Write a label with letters, digits, `-` and `_`: it goes into the class name as it is.

```tsx
const AlertIcon = styled('span', { label: 'AlertIcon' })({ color: 'red' })
// <span class="umber-AlertIcon-1x2y3z">
```

## Object styles and function styles

`styled(tag)(...styles)` takes any number of styles. Each is an object or a function:

- An object is used as it is. A component made only of objects reads no context at run time, and its class is computed once.
- A function receives the component's props and `theme`, and returns an object, `null`, `undefined` or `false` for nothing, or a list of them (below). A function that reads only `theme` is worked out once for each theme (it is part of the base, below). One that reads a prop runs on each render. Equal results give the same class, so nothing grows.

`theme` in a function style is the theme as references: a token is a `var(--name)` string, and everything that is not a token (breakpoints, your own functions) is its real value from the nearest provider. See [Themes](themes.md). A `theme` prop passed to the component is not forwarded to the element and does not replace this `theme`.

Styles merge in order, and a later key wins. In `Row`, none of the three styles reads a prop, so they become one class: `display: flex`, then `padding`, then the media rule and hover rule.

A key whose value is `undefined`, `null` or `false` declares nothing, and does not erase the same key of an earlier style. A parser that sets a property it was not given to `undefined` (`layout` of `@soroush.tech/styled-system` returns `{ width: undefined, height: undefined }` with no `size`) leaves the width of a style before it:

```tsx
const sizeStyle = ({ size = 40 }: { size?: number }) => ({ width: size, height: size })
const safeLayout = (props: { size?: number }) => layout({ ...props, size: undefined })
const Avatar = styled('span')<{ size?: number }>(sizeStyle, safeLayout)
// <Avatar size={80} /> has width: 80px and height: 80px.
```

### A function that returns a list

A function style may return a list instead of one object, nested to any depth. Its items are style objects, `css()` values and sheet entries, further lists, `null`, `undefined` and `false`; they merge in order, the last winning, exactly as if they had been separate styles in that order. A wrapper that adds the overrides of a theme returns as many as apply:

```tsx
const card = css({ padding: 8 })
const Toggle = styled('div')<{ isOn?: boolean }>(({ isOn }) => [
  { color: 'red', margin: 1 },
  [null, isOn && { color: 'blue' }, [undefined, card]],
  false,
])
// <Toggle isOn /> has the class of css({ color: 'red', margin: 1 }, { color: 'blue' }, card):
// margin: 1px, color: blue, padding: 8px.
```

A function that returns a list is cached and compared as one that returns an object is: it reads only `theme`, its list is part of the base class; it reads a prop, its list is part of the props class.

Anything else a function returns is not a style: a string, a number, `true`, a function. In development (`NODE_ENV` is `development`) each is warned about once for each message, with the label of the component, and a list is searched item by item. Outside development nothing is checked: a string is used as a class name, as it always was, and the rest is left out.

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

`theme`, `className` and `style` are the component's own and never reach the element, and so is `as` where it replaces what is rendered (see [`as`](#as)). Of the other props, a string tag such as `'span'` receives by default only those that `@umber-style/is-prop-valid/react` is true for (see [Prop filters](prop-filters.md)):

- the attributes of HTML and SVG, by the names React gives them (`id`, `title`, `type`, `disabled`, `tabIndex`, `htmlFor`, `viewBox`, `strokeWidth`, `xlinkHref` and the rest), and their older spellings (`class`, `for`, `autofocus`);
- `data-*` and `aria-*` attributes in any case, `x-*`, and event handlers (`onClick`, `onPointerDownCapture`: `on` followed by a character whose code is below 91, a capital letter, a digit, `-` or `:`);
- React's own props: `children`, `ref`, `key`, `dangerouslySetInnerHTML`, `defaultValue`, `defaultChecked`, `suppressHydrationWarning`, `suppressContentEditableWarning`.

So a prop that only the styles read stays off the element:

```tsx
const Button = styled('button')<{ variant?: string; isActive?: boolean }>({ color: 'red' })
const go = () => undefined

const App = () => (
  <Button variant="filled" isActive type="submit" data-test="b" aria-label="go" onClick={go} />
)
```

renders `<button type="submit" data-test="b" aria-label="go" class="...">` with the click handler, and neither `variant` nor `isActive`. A custom element (a tag with a hyphen, `'my-element'`) receives every prop, because its attributes are its own. A component (a tag that is not a string) receives every prop but `theme` and `style`, and `className` with the engine's classes in it; a component that is not made by `styled` receives `as` too, unless a `shouldForwardProp` keeps it off.

`shouldForwardProp` replaces that default: with it, a prop reaches the element or the component exactly when it returns `true`, whatever is rendered. In `Badge` above, `(prop) => prop !== 'tone'` keeps `tone` off and forwards everything else, an unknown attribute included.

The list is a module of `@umber-style/is-prop-valid`, a dependency of the binding that an app's bundler includes once: about 4.4 KB minified (2.3 KB gzipped). The Vue and React Native bindings have no default filter, and take the entry of their platform as `shouldForwardProp` when you give it: see [Prop filters](prop-filters.md), [Vue](vue.md) and [React Native](react-native.md).

The filter is applied to what is finally rendered: if you change the element with `as`, the default filter is only used when the new element is a string, and a `shouldForwardProp` you give is used for any element.

## `target`

`target` gives the element a class of your own, after the engine's classes: a stable name that a parent's selector, a test or a tool can find, whatever the hash of the styles is. It is not a style and has no rule. A component that wraps another keeps the wrapped component's `target` and adds its own:

```tsx
const Card = styled('div', { name: 'Card', target: 'card' })({ color: 'red' })
const WideCard = styled(Card, { target: 'wide' })({ width: '100%' })
```

`<Card className="mine" />` renders `<div class="umber-card-root-... mine card">`, and `<WideCard />` renders `<div class="umber-card-root-... card wide">`.

## `as`

The `as` prop renders another element or component in place of the one the component was made from:

```tsx
<Card as="section">...</Card>
```

The class is the same. One rule decides whether `as` replaces what is rendered:

```ts
rendered = (!shouldForwardProp('as') && props.as) || base
```

`base` is what the component was made from (for a styled component made from a styled component, the tag or component at the end of the chain), and `shouldForwardProp` is the filter in effect: the one you give, else the one inherited from the wrapped styled component, else the default for `base`. A filter that keeps `as` off lets it replace the base; one that forwards it passes it on as a prop.

| Made from                                                                                       | Without `shouldForwardProp`                                                                                                                                                     | With `shouldForwardProp`                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A string tag: `styled('button')`                                                                | The default does not forward `as`, which is not an HTML attribute: `as` replaces the tag                                                                                        | `as` replaces the tag too: a filter given for a string tag is not asked about `as`                                                   |
| A styled component: `styled(Button)`                                                            | The two are one element (see [Wrapping a styled component](#wrapping-a-styled-component)): the rule is applied to the base at the end of the chain, with the filter it inherits | The same, with the filter you give                                                                                                   |
| Any other component (a function or class component, `forwardRef`, `memo`): `styled(Typography)` | The default forwards every prop, `as` included: the component is rendered, and `as` is one of its props                                                                         | It returns `false` for `as`: `as` replaces the component. It returns `true`: the component is rendered, and `as` is one of its props |

Where `as` replaces the base, `as` itself is not forwarded, and the props of what is rendered go through the filter in effect when there is one (for a string and for a component alike), else through the default of what is rendered: the attributes of HTML and SVG for a string, every prop for a component.

A styled component made from a styled component made from `Typography` is still made from `Typography`, so the rule is applied to `Typography`. A component that takes `as` itself decides what to render:

```tsx
const join = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
const Typography = ({ as: Tag = 'span', color, variant, className, ...rest }: TypographyProps) => (
  <Tag
    className={join(
      'typography',
      `typography-${variant}`,
      color && `typography-${color}`,
      className
    )}
    {...rest}
  />
)
const Link = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'underline',
})<{ underline?: string }>(({ underline }) => ({ textDecoration: underline }))

const App = () => (
  <Link as="a" color="primary" variant="inherit" underline="always" href="#top">
    top
  </Link>
)
```

renders `<a href="#top" class="typography typography-inherit typography-primary umber-...">top</a>`: the filter forwards `as`, so `Typography` rendered the `a`, its own classes are there, `color` and `variant` were its props and are not attributes, and `underline` was kept off by `shouldForwardProp`.

A filter that keeps `as` off, such as one that forwards only the attributes of HTML, makes `as` replace the component:

```tsx
const TableElement = (props: ComponentProps<'table'>) => <table {...props} />
const Table = styled(TableElement, {
  shouldForwardProp: (prop) => prop === 'id',
})({ borderCollapse: 'collapse' })
// <Table as="div" id="t" /> is <div id="t" class="umber-...">: TableElement is not rendered.
// <Table /> is <table class="umber-...">.
```

In React, `as` of a component that is not made by `styled` is typed by the component's own `as` when it has one (`'span' | 'a'` for `Typography`); otherwise, and made from a tag or a styled component, it is any element type.

## Wrapping a styled component

`styled(Button)(more)` does not render a `Button` inside a new element. It makes one component with the styles of `Button` first and yours after, rendered as the same element with one class. In the example, `WideButton` is one `button` with `background-color`, `color` and `width`. Its label is the labels of both, the inner first: `button-root-wide-button-root`. `shouldForwardProp` is inherited from the wrapped component unless you give one.

Every class of a wrapper carries the labels of the whole chain, joined by `-`, the innermost first (see [The labels of merged styles](#the-labels-of-merged-styles)): the base class and the props class of `Popover = styled(Paper, { label: 'Popover' })` are `umber-Paper-Popover-<hash>`, so the element is found as `Paper` and as `Popover` in its class names. A wrapper given no label adds none, and its classes carry the labels of the components it wraps:

```tsx
const byVariant = ({ variant }: { variant?: string }) => ({ fontWeight: variant ? 700 : 400 })
const Typography = styled('span', { label: 'Typography' })({ margin: 0 }, byVariant)
const Wrapper = styled(Typography, { label: 'W' })({ padding: 1 })
const Plain = styled(Typography)({ padding: 1 })
// <Typography variant="a" /> is <span class="umber-Typography-147y03t umber-Typography-1kjq2di">
// <Wrapper variant="a" />    is <span class="umber-Typography-W-147y03t umber-Typography-W-ddxxt2">
// <Plain variant="a" />      is <span class="umber-Typography-147y03t umber-Typography-bk7s8f">
```

`umber-Typography-W-147y03t` has the declarations of `umber-Typography-147y03t` (the same hash), written again under the labels of the wrapper.

Wrapping any other component works, and then the styles go to that component as a `className`:

```tsx
const Link = ({ className, children }: { className?: string; children: string }) => (
  <a className={className}>{children}</a>
)
const BlueLink = styled(Link)({ color: 'blue' })
```

The component must accept `className` and put it on an element, as it must for any styling that uses classes.

Wrapping a component that has a base class keeps that base. The wrapper's styles come after the styles of the wrapped component, and the split is made on the whole list:

- the wrapped component has props-dependent styles: the wrapper's element carries the same base (under the labels of the chain, when the wrapper has a label of its own), and the rest of the list (the props part of the wrapped component, then all of the wrapper's styles) is its props part;
- the wrapped component has none (it is all base) and the wrapper's styles start with a function that reads props: the element carries the class of the wrapped component as it is, and the wrapper's styles are the props part. With a label of its own, the wrapper has the base under the labels of both after that class, which stays so that the wrapped component as a selector (`${Paper}`) still matches the element: `<div class="umber-Paper-1 umber-Paper-Popover-1 umber-Paper-Popover-2">`;
- the wrapped component has none and the wrapper's styles start with plain objects: the plain objects are added to the base, which is then a new, larger class under the labels of the chain. The declarations of the wrapped component are written again in it. The other choice, keeping the base of the wrapped component and adding the objects as a second fixed class, would write fewer declarations once, but it would put them in the props part, so that they would be repeated in every distinct props class. A wrapper without any props-dependent style also keeps the single class it always had.

## Template strings

The function that `styled(tag, options)` returns can also be used as a tag: the template is CSS text, and it is one style of the component, the same as the equal object. `css` and `keyframes` take the same form (see [Style sheets](style-sheets.md) and [Animations and global styles](animations-and-global-styles.md)), and so does `globalStyles`.

```tsx
const Title = styled('h1', { name: 'Title' })<{ isMuted?: boolean }>`
  margin: 0;
  color: ${({ theme, isMuted }) => (isMuted ? 'gray' : theme.palette.primary)};
  &:hover {
    opacity: 0.8;
  }
  @media (min-width: 600px) {
    font-size: 2rem;
  }
`

const Tag = styled.span`
  padding: ${({ theme }) => theme.space[1]}px 8px;
`
```

The text holds declarations, nested rules (`&:hover { }`, `> p { }`), at-rules that hold rules (`@media`, `@supports`, `@container`), block comments, and line comments (`//`) outside parentheses. A property is written in kebab-case and becomes the camelCase key (`font-size` is `fontSize`); a value is kept as text, so `2rem` stays `2rem`. A property declared twice in one block is a fallback list, as in CSS.

What is between `${ }`:

- a string, a number, an `alpha()` result or a `keyframes` name is text, in a value, a selector or a property name; `null`, `undefined`, `true` and `false` are nothing;
- a style object, a `css()` value or a list of them, standing alone on its line between declarations, is merged in at its place;
- a styled component is a selector (below);
- a function is called with the props and `theme`, as a function style is, and what it returns is read as one of the above. A template with a function is a function style: `Title` reads `isMuted`, so it has a props class for each value; `Tag` reads only `theme`, so it is part of the base, one class.

Give the props a type with the type argument, as `Title` does: the props are not inferred from the functions in a template. A template that cannot be read throws a `TypeError` with its line and the text around the place.

**What the parser costs.** The parser of the template form is part of `@umber-style/core` and is loaded with it, by every binding, also by code that writes objects only: `css`, `keyframes`, `globalStyles` and `styled` import it statically, so a bundler cannot leave it out. It is about 4.7 kB of the 73.7 kB of the core minified (6.4%), and about 1.6 kB of 26.2 kB gzipped (6.0%). Measured with the bundler of the repository (rolldown 1.3, `--minify`, ESM) on `packages/core/src/index.ts`, once as it is and once with `templateStyle.ts` replaced by functions that read nothing: 73,706 and 68,977 bytes minified, 26,210 and 24,646 bytes after `gzip` at its default level.

## A styled component as a selector

A styled component is a selector in a template, and in a key: as text it is `.` and a class that every element of it has.

```tsx
const Icon = styled('span', { name: 'Icon', target: 'icon' })<{ size: number }>(({ size }) => ({
  width: size,
}))
const Button = styled('button', { name: 'Button' })`
  ${Icon} {
    margin-right: 4px;
  }
  &:hover ${Icon} {
    opacity: 0.8;
  }
`
```

The rules are `.umber-button-root-... .icon{margin-right:4px;}` and `.umber-button-root-...:hover .icon{opacity:0.8;}`. The class is:

1. the component's own `target`, when it has one (each of its classes, when it holds several);
2. else, when none of its styles is a function, its class: the one class every element of it has, the same in every build;
3. else there is none, because the classes of its elements depend on the props or the theme, and using it as a selector throws a `TypeError` that asks for a `target`.

In an object style write the key with `at`: `at(`&:hover ${Icon}`, { opacity: 0.8 })`.

## Media keys on React Native

A key that starts with `@media` is the same key on every platform. On the web it is a media rule, and the browser decides it. On React Native there is no style sheet to decide it, so the binding evaluates the query against the window and the system settings and merges the block of a query that matches:

- `min-width`, `max-width`, `width`, the same three for `height`, and their range form (`width >= 600px`, `400px <= width < 800px`);
- `orientation`, `prefers-color-scheme` and `prefers-reduced-motion`;
- `and`, a comma list, `not`, and the media types `all`, `screen` and `only`;
- lengths in `px` or with no unit, and `rem` and `em` as `remBase` times their number.

Any other feature, media type or unit never matches, with a development warning that names it, and `@container` and `@supports` blocks are dropped. The matching blocks merge over the plain keys of their object in the order they are written, as on the web, and a component renders again only when the set of its matching queries changes. See [Media queries](react-native.md#media-queries) for the whole table, what is cached, and `useMediaQuery`.

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

### The labels of merged styles

A component that is not made by `styled` often gives its `className` to a styled root. An engine class that arrives there is read back to its styles and merged into the root's override class, and that class carries the labels of everything merged into it: the labels of the root first, then the labels of the class that came in:

```tsx
const Root = styled('span', { label: 'Typography' })({ margin: 0 })
const Typography = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <Root className={className}>{children}</Root>
)
const Link = styled(Typography, { label: 'Link' })({ color: 'blue' })
const NavLink = styled(Link, { label: 'NavLink' })({ fontWeight: 700 })
// <Typography /> is <span class="umber-Typography-147y03t">
// <Link />       is <span class="umber-Typography-147y03t umber-Typography-Link-3n5swy">
// <NavLink />    is <span class="umber-Typography-147y03t umber-Typography-Link-NavLink-13lzy4r">
```

So the developer tools show which components styled the element, and a test finds it by `-Link-` as well as by `-Typography-`. It is the rule of every merge of labels, in a chain of styled components (above) as through `className`, and in `css()` and `cache.css`:

- the labels are joined by `-` in the order of the merge, the inner component first: `<prefix>-<inner>-<outer>-<hash>`;
- a label that is already written, as a whole run of the `-`-separated parts before it, is not written again: `styled(Button, { label: 'Button' })` adds nothing;
- a style or a class with no label adds none: the class of `styled(Typography)` given to the root leaves `umber-Typography-<hash>`;
- with `hasLabels: false` no class has a label, and the names are `<prefix>-<hash>`;
- a class name that is not the engine's passes through untouched, and a `className` with no engine class in it merges nothing.

Every class the merge makes carries the joined label: the override class with layers, the one merged class of the element without them (`umber-Typography-Link-<hash>`). The base and props classes of the root stay the root's own.

## A value that changes without a render

A plain object in `style` is the default way to give a component a value: each value is a class, and the class of the old value goes when nothing uses it (see [No inline styles](no-inline-styles.md#a-value-that-changes)). For a value that changes many times a second (a slider's thumb, a progress bar, a scroll position) `useStyleValue` writes the class once and changes a CSS variable instead:

```tsx
const style = createStyle({}, { prefix: 'sb' })
const Thumb = style.styled('div', { name: 'Thumb' })({ position: 'absolute' })

function Slider() {
  const [left, setLeft] = style.useStyleValue(10, '%')
  return <Thumb data-testid="thumb" style={{ left: `${left}`, top: multiply(left, 2) }} />
}
```

`setLeft(next)`, or `setLeft((previous) => previous + 5)`, changes the declaration of the variable in place. In `packages/react/src/useStyleValue.test.tsx` 300 calls change the declared value each time, the component renders once, and its class stays the same; in Chromium (`useStyleValue.browser.test.tsx`) the computed `left` follows each of 300 calls with no rule written or removed, and a `transition: left 2s linear` on the element runs (`left` is `100px` halfway between `0px` and `200px`).

The two differences from `useState`:

- The setter renders nothing. What reads the number in JavaScript reads `left.get()`; nothing that rendered from it renders again.
- `left` is not a number. In a style it is the reference to its variable, `var(--<prefix>-value-<id>, 10%)`: write it in a template string (`${left}`) or give it to `add`, `subtract`, `multiply`, `divide` and `negate`, which take it as they take a token. `left + 1` is a type error. `left.get()` is the number.

**The unit.** The variable holds the number as the engine writes a number for any custom property: as it is, with no unit. Give the unit as the second argument (`useStyleValue(0, 'px')`, `useStyleValue(10, '%')`) and the variable holds `0px`, `10%`, so `left: ${left}` is a length. A unit is `%` or letters; another throws a `TypeError`, and so does a number that is not finite.

**Where it is declared.** While the component is mounted its variable is declared in a rule of its own, `:root{--<prefix>-value-<id>:10%;}`, in the theme layer (`@layer <prefix>-theme`, or no layer without layers), in a style element of its own, `<style data-style="<prefix>-values">`, written with `insertRule`, so a change touches that one declaration and parses nothing. The element carries the nonce of the cache. Under a `CacheProvider` the variable is named after the provider's prefix and declared in its cache's document (an iframe's: tested in Chromium too). The rule is removed when the component unmounts. No `style` attribute is rendered.

**A server render.** The reference carries the first number as its fallback, so the class that a server sends with the page shows it with no rule and no script: `{left:var(--ss-value-..., 25%);}` (`useStyleValue.ssr.test.tsx`). The variable is named from `useId`, so the browser makes the same class, and hydration writes nothing again; the rule is declared once the component is mounted. In the server components build `useStyleValue` gives a value whose reference is its first number, and its setter changes only `get()`, with a warning in development: a server component does not run in the browser.

**Vue.** `useStyleValue(initial, unit?)` in `setup` gives the value in the shape of a ref: `${left}` in a style, `left.value = 40` to change it with no render, `left.value` and `left.get()` to read it (`packages/vue/src/useStyleValue.test.ts`).

Use a plain object in `style` for a value that changes now and then (a size from a prop, a measured width): it is the default, and costs a class per value. Use `useStyleValue` for one that changes on every frame. Measured by `packages/react/bench/values-setter.bench.ts` in jsdom (50 changes, then one macrotask): 1.40 ms through the setter, 9.19 ms through a render with a plain object in `style`.

## Limits

- What the template form does not read: an at-rule that is a statement (`@import`, `@charset`) is an error; `/*` inside an unquoted `url(...)` starts a comment (quote the URL); an interpolation is a statement of its own only when it stands alone on its line, so `${card} color: red;` reads `${card} color` as a property name; a value is text, so a number without a unit (`padding: 8`) is written as `8`, where the object `{ padding: 8 }` writes `8px`; a nested selector without `&` (`a:hover { }`) is a descendant of the element.
- The template form is not offered by `styled` on React Native in this release; `css` and `keyframes` take it there.
- The parser of the template form is loaded by code that never writes a template: about 1.6 kB gzipped of the core (see [Template strings](#template-strings) for how it was measured). It is not split into a module of its own that loads on first use.
- A styled component is a selector only by its `target` or, without a function style, by its class. A component that wraps it has its own class, so `${Button}` does not match the elements of `styled(Button)(...)`, except where the wrapper's styles start with a function that reads props (see [Wrapping a styled component](#wrapping-a-styled-component)); a `target` is kept by every wrapper.
- A wrapper with a label of its own writes the base of the wrapped component again under the labels of the chain: one more rule of the same declarations for each such wrapper. Without a label it shares the base.
- A class merged through `className` is one class for each distinct joined label: the same styles given to two roots (`Typography-Link`, `Button-Link`) are two rules of the same declarations, one for each pair that meets. A class name grows by one label for each labelled level of a chain.
- A label that is a whole run of the `-`-separated parts of the labels before it is not written again: a component labelled `root` that wraps one labelled `button-root` adds nothing. Labels are not checked for this when they are given.
- `as` always replaces a string tag, also when a `shouldForwardProp` given for it returns `true` for `as`: there the one-line rule would forward `as` as an attribute and keep the tag.
- `as` of a component that is not made by `styled` is that component's prop, unless the filter keeps it off: the styled component does not check it, and a component that ignores it renders what it always renders. A filter is asked about `as` once, when the styled component is made. React Native keeps its own rule: there `styled` takes components only, and `as` replaces the component (see [React Native](react-native.md)). In Vue, `shouldForwardProp` is used for a string tag only, so `as` always reaches such a component. With `hasLayers: false`, an element that is given something in `style` or an engine class in `className` has one merged class and not the component's class: use a `target`.
- With the strict style types, a key built at run time (a media query made from a breakpoint, for example) written directly in a web style object is a type error: write it with `at(key, style)`. The default types take it directly. See [Typed styles](typed-styles.md).
- The default filter knows the attributes of HTML and SVG under their React names. A lowercase or hyphenated spelling (`tabindex`, `stroke-width`) and an attribute that is not in the specifications (a vendor attribute, a new one) do not reach the element unless `shouldForwardProp` lets them, and a prop of your own that has the name of an attribute (`color`, `size`, `label`, `width`) does reach it.
- The shorthands are typed for the tags of React's JSX types (React) and Vue's (Vue). At run time any name that starts with a lowercase letter is made into a tag, except `then`.
- A function style that reads props runs on every render of its component. Keep it cheap. One that reads only `theme` runs once for each theme object.
- Style functions must be pure: the base keeps the first result of a function that read no prop, for a theme. A function that reads a prop only inside something it returns (a callback) is not seen reading it.
- A `label` is not checked: a space or a character that a class name cannot hold is written into the class name as it is.
- Only the tags of React's JSX types are own members of `styled` (in Vue too, which shares the list). `Object.assign` does not copy another name that a shorthand would make on access, such as a custom element: write `styled('my-element')` for it.
- A value that a function style returns that is not a style is checked in development only, where `process.env.NODE_ENV` is `development`. A key whose value is `undefined`, `null` or `false` cannot be used to remove an earlier declaration: give the property another value, such as `initial` or `auto`.
- `useStyleValue` does not exist on React Native: a variable does not exist there, and its form on the platform waits for its animations (a later task). A source that calls it runs on the web only.
- The value of `useStyleValue` is placed in a style through a template string or a helper. The value object itself is not a style value: the types reject it, and given from plain JavaScript it is read as a nested style. The helpers take it as an operand; their factor is still a number (`multiply(left, 2)`), so a unit is given to the value, not to `multiply`.
- Each component that calls `useStyleValue` has a variable of its own, so each has a class of its own for the style that reads it. The variable is named from `useId`: two React roots of one page with the same `identifierPrefix` could give two components the same name.
- The cache of a value is the one above the component when it first rendered: a `CacheProvider` that changes its `value` later does not move it.
- The rule of a value is declared in an effect (an insertion effect in React, `onMounted` in Vue): until then, and on a page with no script, the fallback (the first number) is in effect. `extractPageStyles` does not send the rule: there is none on a server.
- The benchmark runs in jsdom, which computes no layout and paints nothing: what a browser does after the change is in neither case. The frame times of a real slider (the Definition of Done of the issue) were not measured here.
