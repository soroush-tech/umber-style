import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import type { OnRenderClientSync } from 'vike/types'
import { PageShell } from './PageShell'

let root: Root | undefined

export const onRenderClient: OnRenderClientSync = (pageContext) => {
  const { Page } = pageContext
  const page = (
    <PageShell>
      <Page />
    </PageShell>
  )
  const container = document.getElementById('root')!
  if (pageContext.isHydration) {
    root = hydrateRoot(container, page)
  } else {
    root ??= createRoot(container)
    root.render(page)
  }
}
