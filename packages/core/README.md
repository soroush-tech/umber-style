# @umber-style/core

The UmberStyle engine: theme tokens as CSS variables, the class cache and theme classes. It knows no framework.

Install: `pnpm add @umber-style/core`.

```ts
import { createEngine } from '@umber-style/core'

const engine = createEngine({ palette: { primary: '#1b5fd1' } }, { prefix: 'app' })
```

Documentation: [docs](../../docs/README.md), and [plain JavaScript](../../docs/plain-javascript.md) for this package.
