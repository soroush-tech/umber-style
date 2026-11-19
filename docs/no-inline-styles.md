# No inline styles

After this page you can say what the engine guarantees about the `style` attribute, what happens to a value that changes often, and what a content security policy has to allow.

## The guarantee

On the web the engine never renders a `style` attribute. Not on a provider's wrapper, and not on a styled component.

- A wrapper made by `ThemeProvider` has classes only: the theme class, `<prefix>-boundary`, the scheme marker for `light` and `dark`, `<prefix>-scope` and your `className`. The `<prefix>-scope` class holds `display: contents`. The theme class itself has no `display`, because the same class goes on `<html>`.
- Everything given in the `style` prop of a styled component, sheet entries and plain objects, in order, is merged into one class of the element: into the override class, after the component's own styles and before a `className` you pass. A string is an error, because it cannot be merged.
- `apply()` returns the class (`{ className }` in React, `{ class }` in Vue) and nothing else.

You can check this on the output of any example in these pages: no `style=` appears in the markup. The tests check it for a root provider, a nested provider, a styled component with entries and with objects, `apply`, and a server render.

Passing an object to the `style` prop of a styled component is the engine's own API. It becomes a class. It is not an inline style, and no attribute is rendered:

```tsx
const Bar = styled('div', { name: 'Bar' })({ height: 4 })

const App = () => (
  <ThemeProvider theme={theme}>
    {[10, 20, 30].map((value) => (
      <Bar key={value} style={{ width: value }} />
    ))}
  </ThemeProvider>
)
```

```html
<div class="umber-bar-root-1vrm674 umber-bar-root-qd9pgc"></div>
<div class="umber-bar-root-1vrm674 umber-bar-root-18oqfqd"></div>
<div class="umber-bar-root-1vrm674 umber-bar-root-tyce6a"></div>
```

```css
@layer umber-components {
  .umber-bar-root-1vrm674 {
    height: 4px;
  }
}
@layer umber-overrides {
  .umber-bar-root-qd9pgc {
    width: 10px;
  }
}
@layer umber-overrides {
  .umber-bar-root-18oqfqd {
    width: 20px;
  }
}
@layer umber-overrides {
  .umber-bar-root-tyce6a {
    width: 30px;
  }
}
```

React Native is unchanged: a style object is how it works there, and there is no attribute to avoid.

## A value that changes

Each distinct style is one class and its rules, and that class stays in the cache and in the style sheet for as long as the page lives. A value that changes often, such as an animated number or a measured size, makes a new class for each value, as the three `Bar` widths show. Over a long session that is many rules.

So do not pass such a value through `style`. Use a style that changes by class (a state with a few values), a CSS transition or animation, or drive the value in a way that the engine is not part of. The engine has no mechanism to remove a class.

## A plain element

The `style` prop is the engine's only on a component made by `styled()`. A sheet entry given to the `style` of a plain element is not merged into a class: React puts it on the element as a style attribute, holding a custom property named after the class. The types reject it (`SharedEntry` is not a `CSSProperties`), so you see it as an error. For a plain element use `apply`:

```tsx
<p {...apply(styles.box)}>a plain element</p>
```

An object you give to the `style` of a plain element yourself is React's own, and the engine has nothing to do with it.

## Content security policy

With no style attributes, a policy with `style-src` that forbids inline style attributes is satisfied by what the engine renders. The engine still inserts CSS in `<style>` elements:

- the element that the cache makes in the browser, with `data-style="<prefix>"`, to which rules are added with `insertRule`;
- the element that `createStyleTag` writes for a static page or a classic server render, which has its CSS as text;
- the `<style href precedence>` elements of the server components build, which have their CSS as text.

A policy that blocks inline `<style>` elements needs a nonce or a hash for the ones that have text. **There is no nonce option today**: not in the cache, in `createDomSheet`, in `createStyleTag` or in the server components build. That is a gap. A `createStyleTag` element can have a nonce added to the string by your own code, since it is a string; the cache's own element and the server components elements cannot.

How a browser treats a style element that a script creates empty and fills with `insertRule` under a given policy was not tested. It is browser behaviour.

The head script that applies a stored theme (see [The root theme and switching](root-theme.md)) is an inline script: it needs a nonce or a hash for `script-src`.

## Limits

- The guarantee is about what the engine renders. Your own components, third-party components and the `style` of a plain element are not covered.
- No nonce support, as above.
- The cache never removes classes: see "A value that changes".
- The check that no `style` attribute is rendered was run in jsdom and for server render output. It was not run in a browser.
