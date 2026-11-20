# @umber-style/cache

The UmberStyle cache for server-rendering setups: the engine's cache, keyed by `key`, with `compat`, `insert`, `inserted`, `registered` and `sheet`.

Install: `pnpm add @umber-style/cache`.

```ts
import createCache from '@umber-style/cache'

const cache = createCache({ key: 'app' })
```

Documentation: [docs](../../docs/README.md), and [Server rendering](../../docs/server-rendering.md) for this package.
