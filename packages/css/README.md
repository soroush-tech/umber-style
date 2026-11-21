# @umber-style/css

UmberStyle's plain layer: a style goes to a cache and comes back as a class name. It needs no framework, no theme and no provider.

Install: `pnpm add @umber-style/css`.

```ts
import { css, cx } from '@umber-style/css'

const card = css({ padding: 8, '&:hover': { opacity: 0.9 } })
```

Documentation: [docs](../../docs/README.md), and [class names without a theme](../../docs/css.md) for this package.
