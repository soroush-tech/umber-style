# Cascade layers and overrides

After this page you can say which of two styles wins and why, override a component from outside, fit your own CSS and a reset around the engine's, and turn layers off.

## The four layers

Every rule the engine writes is in a CSS cascade layer. The layers are named after the cache prefix (`css` by default) and are declared in this order, lowest priority first, by the first rule of the sheet:

```css
@layer umber-theme, umber-global, umber-components, umber-overrides;
```

| Layer                 | What goes in it                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `<prefix>-theme`      | The theme classes (the token variables) and the `display: contents` rule of the `<prefix>-scope` class |
| `<prefix>-global`     | Reserved for global styles. Nothing is written there yet                                               |
| `<prefix>-components` | The own styles of a `styled` component, and sheet entries used on their own (`css`, `apply`)           |
| `<prefix>-overrides`  | What a component is given from outside: its `style` prop, and engine classes in its `className`        |

A later layer beats an earlier one whatever the specificity. So a property that you give a component through `style` beats the same property in any rule of the component, its `&:hover` rule included. A worked example with output is in [Style sheets and the style prop](style-sheets.md).

Inside one layer, the usual cascade applies: specificity, then source order.

`@property` rules (see [Tokens](tokens.md)) are written outside every layer, because `@property` is a registry of the document, not a style that cascades.

## Two classes per element

An element made by `styled` can carry two engine classes:

- its component class, in the `components` layer: all of the component's own styles, merged;
- only when something is given from outside, one override class, in the `overrides` layer: everything given (the `style` prop and engine classes in `className`), merged in order, the last winning.

Both keep the component's label, so they can be told apart in the developer tools (`umber-button-root-sx8930 umber-button-root-11gr2ac`). A class name that is not the engine's passes through unchanged and stays in front. `styled(Button)(more)` is still one component class, not two: wrapping merges styles, see [Writing styles](writing-styles.md).

A component with no styles of its own that is given something from outside has the override class only.

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

## Turning layers off

Pass `hasLayers: false` (to `createCache`, `createEngine`, `createStyle` or `configure`) to write no `@layer` and give each element one merged class:

```ts
const style = createStyle(theme, { prefix: 'umber', hasLayers: false })
```

For a button with `color: red` and `'&:hover': { color: 'orange' }` that is given a sheet entry with `color: blue`, the rules are:

```css
.umber-1vpmm88 {
  color: blue;
}
.umber-button-root-191a01u {
  color: blue;
}
.umber-button-root-191a01u:hover {
  color: orange;
}
```

The merged class has the entry's colour, but the hover rule of the component still sets orange. Without layers, a style given from outside does not beat a nested rule of the component such as `:hover`, unless it has its own nested rule. The first rule is the entry's own class, written when the entry was made; the element does not use it.

## Limits

- Layers need a browser that supports `@layer`; one that does not drops every rule. The versions are to be confirmed: see [Browser and platform support](browser-support.md).
- The `global` layer is declared and empty. Nothing in the engine writes to it.
- That a reset placed before the engine's `<style>` ends up under the engine's layers follows the specification's rule for layer order. It was not tried in a browser.
- Whether a rule beats another in a real browser is the browser's cascade; the tests check the rule text, the layer each rule is in, and the classes on the element.
