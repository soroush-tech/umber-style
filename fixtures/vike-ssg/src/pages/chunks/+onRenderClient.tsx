import createCache from '@umber-style/cache'
import { hydrateRoot } from 'react-dom/client'
import type { OnRenderClientSync } from 'vike/types'
import { ChunksShell } from './ChunksShell'

// The cache of the browser reads the style elements that the server wrote, and writes none of their
// rules again.
export const onRenderClient: OnRenderClientSync = (pageContext) => {
  const { Page } = pageContext
  const cache = createCache({ key: 'umber' })
  hydrateRoot(
    document.getElementById('root')!,
    <ChunksShell cache={cache}>
      <Page />
    </ChunksShell>
  )
}
