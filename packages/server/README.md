# @umber-style/server

Server rendering over an UmberStyle cache: the CSS of one page, as chunks and as `<style data-umber>` tags.

Install: `pnpm add @umber-style/server`.

```ts
import createInstance from '@umber-style/server/create-instance'

const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(cache)
```

Documentation: [docs](../../docs/README.md), and [Server rendering](../../docs/server-rendering.md) for this package.
