# styledParts.ts

Build: both (no hook, no context; the server guard lists it).

## What it does

`prepareStyled(engine, tag, options, styles)` does what both `styled` builds share. It makes the engine's
`Styler` for a component, and returns `{ styler, resolve, statics }`. `resolve(props, theme, canHold, cache)`
gives `{ element, forwarded, className, isHeld, hold }` for one render: the element to render, the props that
reach it, the class, whether the `style` prop holds a plain object, and the hold of the class made from it.

## Why it exists

The client `styled.ts` and the server `styled.server.ts` differ in hooks and in how they send style elements,
and not in how a class and the forwarded props are decided. Keeping that in one file keeps the two builds
equal.

## The logic

```mermaid
flowchart TD
  tag["tag, options, styles"] --> inner{"tag is a styled component?"}
  inner -->|yes| flat["baseTag = its _tag; styles joined after its _styles"]
  inner -->|no| plain["baseTag = tag"]
  flat --> replaced
  plain --> replaced{"as replaces the base?"}
  replaced --> styler["engine.createStyler(options, styles, inner styles)"]
  styler --> resolve["resolve(props, theme, canHold, cache)"]
  resolve --> own{"cache given?"}
  own -->|yes| other["styler of engine.withCache(cache), made once"]
  own -->|no| main["the styler"]
  other --> cls["class from props and style prop entries"]
  main --> cls
  cls --> plain["isHeld: a plain object among the values of style"]
  plain --> hold{"canHold and isHeld?"}
  hold -->|yes| held["getHeldClass: className + hold"]
  hold -->|no| get["getClassName"]
  held --> filter["element, filter, forward props"]
  get --> filter
```

## The data

- `StyledStatics`: `_styles`, `_tag`, `_shouldForwardProp`, `_target`, `toString` (a selector made by
  `createComponentSelector`).
- Stylers for other caches live in a `WeakMap` from an engine to a `Styler`, made on first use.

## What it guarantees

- `as` always replaces a string tag. For a component it replaces only when `shouldForwardProp('as')` is
  false (the comment in the file); otherwise the component gets `as` as a prop.
- The props are read with `Object.keys` and each value by its key, in the order of `Object.entries`, so that
  a render makes no array of pairs.
- `theme`, `className` and `style` are never forwarded; `as` is not when it replaces the element.
- The filter is: the one given; else, for a string tag, `isPropValid` of `@umber-style/is-prop-valid/react`
  (a tag with a hyphen forwards every prop); none for a component.
- Everything in `style` (entries, plain objects) and `className` joins the one class, after the styles. No
  `style` attribute is ever rendered.
- `target` classes of wrapped components and of this one are joined and added after the engine's classes.
- `forwarded.className` is `undefined` when empty.
- `isHeld` depends on the props only, so a server and the browser agree on it: `styled.ts` renders a place
  after the element on both sides when it is true (the browser's `Hold`, `null` on a server). A plain object
  is an object that is not a sheet entry, the same test as `getHeldClass` of the core.
- `isStyledComponent` is exported for `styled.ts`, which reads the `_tag` of a styled element below an
  element to know whether a component is below it.

## Decisions

- Wrapping a styled component flattens: the new component has the base tag and the styles of both.
- The styler over another cache is made lazily, for a component used under a `CacheProvider`.

## Limits

- A custom element receives every prop, valid or not (the hyphen rule).
