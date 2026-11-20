# @umber-style/styled

**Legacy.** This package exists for code that imports `styled` as the default export of a package of its own, so that only the name of the package has to change. It holds one line: a re-export of the `styled` of `@umber-style/react`. It is for React only.

New code uses `@umber-style/react` instead, and does not need this package:

```tsx
import { styled } from '@umber-style/react'

const Card = styled.div({ padding: 16, borderRadius: 8 })
```

The two are the same function, with the same engine, cache and theme.

## For existing code

Install: `pnpm add @umber-style/styled @umber-style/react`.

```tsx
import styled from '@umber-style/styled'

const Card = styled.div({ padding: 16, borderRadius: 8 })
```

A server component gets the server build of `styled`, as with `@umber-style/react`.

Documentation: [docs](../../docs/README.md), and [Writing styles](../../docs/writing-styles.md) for `styled`.
