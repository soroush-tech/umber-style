import createCache from '@umber-style/cache'
import createInstance from '@umber-style/server/create-instance'
import { renderToString } from 'react-dom/server'
import { dangerouslySkipEscape, escapeInject } from 'vike/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import { ChunksShell } from './ChunksShell'

// The other render of this fixture: a cache of `@umber-style/cache` for the page, given to the tree
// with CacheProvider, and the CSS of the page as chunks of `@umber-style/server`, in the head.
export const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
  const { Page } = pageContext
  const cache = createCache({ key: 'umber' })
  const html = renderToString(
    <ChunksShell cache={cache}>
      <Page />
    </ChunksShell>
  )
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createInstance(cache)
  const styleTags = constructStyleTagsFromChunks(extractCriticalToChunks(html))
  return escapeInject`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UmberStyle chunks</title>
    <link rel="icon" href="data:," />
    ${dangerouslySkipEscape(styleTags)}
  </head>
  <body>
    <div id="root">${dangerouslySkipEscape(html)}</div>
  </body>
</html>`
}
