# Cascade layers and overrides

After this page you can say which of two styles wins and why, override a component from outside, fit your own CSS and a reset around the engine's, and turn layers off.

## The four layers

Every rule the engine writes is in a CSS cascade layer. The layers are named after the cache prefix (`css` by default) and are declared in this order, lowest priority first, by the first rule of the sheet:

```css
@layer umber-theme, umber-global, umber-components, umber-overrides;
```

| Layer                 | What goes in it                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `<prefix>-theme`      | The theme classes (the token variables) and the `display: contents` rule of the `<prefix>-scope` class                               |
| `<prefix>-global`     | Global styles: the rules of `Global` and `engine.insertGlobal` (see [Animations and global styles](animations-and-global-styles.md)) |
| `<prefix>-components` | The own styles of a `styled` component (its base class and its props class), and sheet entries used on their own (`css`, `apply`)    |
| `<prefix>-overrides`  | What a component is given from outside: its `style` prop, and engine classes in its `className`                                      |

A later layer beats an earlier one whatever the specificity. So a property that you give a component through `style` beats the same property in any rule of the component, its `&:hover` rule included. A worked example with output is in [Style sheets and the style prop](style-sheets.md).

Inside one layer, the usual cascade applies: specificity, then source order.

`@property` rules (see [Tokens](tokens.md)) are written outside every layer, because `@property` is a registry of the document, not a style that cascades. So are the `@keyframes` rules of `keyframes`, which are looked up by name.

A global rule is in the `global` layer, so a class of a component beats it whatever the specificity: `html body main p#styled` in a global rule loses to a class (a real-browser test, `global.browser.test.ts`, checks it). A global rule beats only what is in the `theme` layer: the theme classes, and the `display: contents` of a provider's wrapper, so a global rule that sets `display` on every `div` would give the wrapper a box.

## Up to three classes per element

An element made by `styled` can carry three engine classes, in this order:

- its base class, in the `components` layer: the leading styles that do not depend on props (they may use tokens), made once;
- its props class, in the `components` layer: the styles from the first one that depends on props, made for each distinct result;
- only when something is given from outside, one override class, in the `overrides` layer: everything given (the `style` prop and engine classes in `className`), merged in order, the last winning. When what is given is exactly one sheet entry, the entry's own class is the override class and nothing is merged: see [Style sheets and the style prop](style-sheets.md).

The base and the props class keep the component's label, so the developer tools show `umber-flex-root-182dnr0 umber-flex-root-1o6pbk7`; the base is the first of the two. The override class made by merging keeps the label too. A class name that is not the engine's passes through unchanged. A component with no props-dependent style has the base class only, and one whose first style depends on props has no base class. See [How it works](how-it-works.md) for the split. `styled(Button)(more)` is still one element: wrapping flattens the styles, see [Writing styles](writing-styles.md).

A component with no styles of its own that is given something from outside has the override class only.

## The base and the props class in one layer

The base and the props class are in the same layer, `components`, with no sub-layer. Inside one layer the usual cascade applies, and the engine writes the base before any props class of the same component. So:

- Both set a plain property: the props class wins. Same specificity, and it is written later.
- The base has `&:hover` and the props class sets the same property plainly: the base's `:hover` rule wins while hovered, because it is more specific.
- Both have `&:hover`: the props class wins, by order.
- The base has a media query (or another at-rule, such as `@container`) and the props class sets the same property plainly: the props class wins at every width. This differs from one merged class, which wrote the plain declarations first and the at-rule after them, so that the at-rule won. If a media rule of the base must beat a plain property of the props part, write the plain property in the media rule too.

The order is kept in every place the rules go:

- The browser sheet: rules are appended in the order the classes are first made, and the base is made before the props class every time.
- The CSS a server or a build extracts, and what a browser reads back from it: the same order, and a client that finds a rule for the class in the page does not write it again, so it never writes a props class ahead of a base that came from the server.
- The server components build, where each class is its own `<style href precedence>` element: an element renders its base before its props class, so React meets the base first and keeps hoisted styles of one precedence in the order it first met them. Two components can make the same props result with different bases (always with `hasLabels: false`, and for components with no name); the class name of a props class therefore includes its base, so two components never share a props class, and each is written after its own base.
- Theme classes are in the `theme` layer, under the components. Pruning rewrites a theme rule in place, or adds another, but never touches a component rule, so it cannot change this order.
- Without layers, the same: the base is written before its props class. What is given from outside is merged into one class, so there is nothing to order.

## Unlayered CSS and resets

Unlayered CSS always beats layered CSS, whatever its specificity. That makes it easy for your own stylesheet to override a component: write the rule, and it wins. It also means that an unlayered reset such as `button { background: none }` overrides the component styles. Put a reset in a layer that is declared before the engine's:

```css
@layer reset, umber-theme, umber-global, umber-components, umber-overrides;
@layer reset {
  button {
    background: none;
  }
}
```

The order of layers is fixed by the first place each name is declared in the document, across all style sheets, and a later statement never reorders it. The engine's own statement does not help you here: it comes first in the engine's sheet, but a sheet that your app adds after it would put `reset` after `umber-overrides`, which gives the reset the highest priority. So your statement must be in a `<style>` or `<link>` that comes before the engine's `<style>` in the document. The same holds for the server components build, where every `<style href precedence>` starts with the statement.

A reset written with `Global` needs none of this: its rules go into `<prefix>-global`, which is already under the components. See [Animations and global styles](animations-and-global-styles.md).

## Turning layers off

Pass `hasLayers: false` (to `createCache`, `createEngine`, `createStyle` or `configure`) to write no `@layer` and give each element one merged class:

```ts
const style = createStyle(theme, { prefix: 'umber', hasLayers: false })
```

For a button with `color: red` and `'&:hover': { color: 'orange' }` that is given a sheet entry with `color: blue`, the rules are:

```css
.umber-button-root-191a01u {
  color: blue;
}
.umber-button-root-191a01u:hover {
  color: orange;
}
```

The merged class has the entry's colour, but the hover rule of the component still sets orange. Without layers, a style given from outside does not beat a nested rule of the component such as `:hover`, unless it has its own nested rule. The entry's own class is not written: nothing used it.

Without layers an element that is given something from outside has one merged class, with the component's own styles in it, and no base class. An element that is given nothing has its base and props classes as usual.

## Limits

- Layers need a browser that supports `@layer`; one that does not drops every rule. The versions are to be confirmed: see [Browser and platform support](browser-support.md).
- With `hasLayers: false`, global rules are written outside every layer in the order they are inserted, so a global rule written after a class beats it at equal specificity. That follows from the order of the rules; it was not run in a browser.
- That a reset placed before the engine's `<style>` ends up under the engine's layers follows the specification's rule for layer order. It was not tried in a browser.
- Whether a rule beats another in a real browser is the browser's cascade; the tests check the rule text, the layer each rule is in, and the classes on the element. The cases of "The base and the props class in one layer" were also checked in a real browser, with the rules the engine writes put in a page by hand (in one layer, in separate `<style>` elements as the server build sends them, and with a props class shared by two bases to see what the salt prevents), with `:focus` standing in for `:hover` (same specificity). The engine was not run in that browser, and the server build was not rendered by React there.
