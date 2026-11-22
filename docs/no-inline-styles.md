# No inline styles

After this page you can say what the engine guarantees about the `style` attribute, what happens to a value that changes often, and what a content security policy has to allow.

## The guarantee

On the web the engine never renders a `style` attribute. Not on a provider's wrapper, and not on a styled component.

- The wrapper of a nested `ThemeProvider` has classes only: the theme class, `<prefix>-boundary`, the scheme marker for `light` and `dark`, the theme class of its merged theme, `<prefix>-scope` and your `className`. The outermost provider renders no element: its theme is a rule on `:root`. The `<prefix>-scope` class holds `display: contents`. The theme class itself has no `display`, because the same class goes on `<html>`.
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

```text
@layer umber-components{.umber-bar-root-1vrm674{height:4px;}}
@layer umber-overrides{.umber-bar-root-qd9pgc{width:10px;}}
@layer umber-overrides{.umber-bar-root-18oqfqd{width:20px;}}
@layer umber-overrides{.umber-bar-root-tyce6a{width:30px;}}
```

React Native is unchanged: a style object is how it works there, and there is no attribute to avoid.

## A value that changes

Each distinct style is one class and its rules, as the three `Bar` widths show. A class made from a plain object given in `style` lives only while elements use it, so a value that changes often, such as an animated number or a measured size, leaves no class behind:

- In the browser, each element that renders the class counts it. When the last one takes another value or unmounts, the class is removed from the style sheet and forgotten by the cache. The same value later writes it again.
- The removal waits one macrotask (a `setTimeout` of 0), so a value that goes and comes straight back keeps its class. The new class is written during render, before the browser paints the element that has it; the old one goes only after the commit that took it off.
- Two elements with the same value share one class, which goes when the last of them changes or unmounts.
- A sheet entry, a `css()` value and a class made only from entries are permanent, as before: the entry is shared and may be used again at any time.
- On a server nothing is removed: a server render is one pass. In the browser a class that the server sent is taken over and removed from the page when no element uses it any more.

One element whose `width` took a hundred values, one after the other, ends with one rule for it in the sheet (`packages/react/src/heldStyle.test.tsx`, and the same in Vue); in a real browser fifty values leave one rule, and the element has the right width at each step (`heldStyle.browser.test.tsx`).

What it costs: each new value writes one rule and later removes one, and an element that is given a plain object counts its class (an insertion effect in React, a function ref in Vue). That is slower than a style attribute. A value that changes on every frame is better driven another way: a CSS transition or animation, or a plain element whose `style` you set on purpose.

## A plain element

The `style` prop is the engine's only on a component made by `styled()`. A sheet entry given to the `style` of a plain element is not merged into a class, and the engine does not put a style attribute on that element either: an entry has one enumerable key, a custom property named after its class with the value `null`, and both React and Vue skip a `null` style value. The types reject it (`SharedEntry` is not a `CSSProperties`), so you see it as an error, and the element gets no class either. For a plain element use `apply`:

```tsx
<p {...apply(styles.box)}>a plain element</p>
```

An object you give to the `style` of a plain element yourself is React's own, and the engine has nothing to do with it.

## Content security policy

With no style attributes, a policy with `style-src` that forbids inline style attributes is satisfied by what the engine renders. The engine still inserts CSS in `<style>` elements:

- the element that the cache makes in the browser, with `data-style="<prefix>"`, to which rules are added as text nodes outside production and with `insertRule` in production;
- the element that `createStyleTag` writes for a static page or a classic server render, which has its CSS as text;
- the `<style href precedence>` elements of the server components build, which have their CSS as text.

A policy that blocks inline `<style>` elements needs a nonce or a hash for the ones that have text. **There is no nonce option today**: not in the cache, in `createDomSheet`, in `createStyleTag` or in the server components build. That is a gap. A `createStyleTag` element can have a nonce added to the string by your own code, since it is a string; the cache's own element and the server components elements cannot.

How a browser treats a style element that a script creates empty and fills with `insertRule` or with text nodes under a given policy was not tested. It is browser behaviour.

The head script that applies a stored theme (see [The root theme and switching](root-theme.md)) is an inline script: it needs a nonce or a hash for `script-src`.

## Limits

- The guarantee is about what the engine renders. Your own components, third-party components and a plain style object given to the `style` of a plain element are not covered. A sheet entry given there adds nothing to the attribute.
- Vue's server renderer writes `style=""` for every `style` prop of a plain element, even `null`, so a plain element that is given a sheet entry has an empty `style` attribute in Vue's server output. Nothing is declared in it. React writes no attribute.
- No nonce support, as above.
- A class made from a plain object in `style` is removed only in the browser, after one macrotask, and only by a sheet that can remove rules (the DOM sheet and `createMemorySheet` can; a `Sheet` of your own without `remove` keeps every rule). A value that changes on every frame costs one rule written and one removed for each change.
- A class taken over from a server render is removed from the page only when all of its rules are found in the engine's style elements; otherwise it stays.
- The override class is in the `overrides` layer: an `!important` rule of the app, or CSS outside the engine's layers, wins over it, where a style attribute would win over every normal rule.
- The check that no `style` attribute is rendered was run in jsdom and for server render output. It was not run in a browser, so what a browser does with a `null` custom property value on `element.style` is not observed.
