import { bootScript } from '@umber-fixtures/shared/bootScript'
import { darkClass, lightClass, style } from '@umber-fixtures/shared/style'
import { createStyleTag } from '@umber-style/core'
import { renderToString } from 'react-dom/server'
import { dangerouslySkipEscape, escapeInject } from 'vike/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import { PageShell } from './PageShell'

// The approach of docs/server-rendering.md: render, then ask the cache for what it holds.
export const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
  const { Page } = pageContext
  const html = renderToString(
    <PageShell>
      <Page />
    </PageShell>
  )
  const styleTag = createStyleTag(style.cache)
  return escapeInject`<!doctype html>
<html lang="en" class="${lightClass}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UmberStyle fixture</title>
    <link rel="icon" href="data:," />
    ${dangerouslySkipEscape(styleTag)}
    <script>${dangerouslySkipEscape(bootScript(lightClass, darkClass))}</script>
  </head>
  <body>
    <div id="root">${dangerouslySkipEscape(html)}</div>
  </body>
</html>`
}
