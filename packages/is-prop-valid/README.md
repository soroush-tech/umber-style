# @umber-style/is-prop-valid

Whether a prop is one that an element takes: the attributes of HTML and SVG under React's names (`/react`) or as Vue writes them (`/vue`), and the props of React Native's built-in components (`/react-native`). Each subpath is one function, `(prop: string) => boolean`.

Install: `pnpm add @umber-style/is-prop-valid`.

```ts
import isPropValid from '@umber-style/is-prop-valid/react'

isPropValid('tabIndex') // true
isPropValid('variant') // false
```

Documentation: [docs](../../docs/README.md), and [Prop filters](../../docs/prop-filters.md) for this package.
