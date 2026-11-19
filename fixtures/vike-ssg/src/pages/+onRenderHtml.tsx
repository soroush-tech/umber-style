import { bootScript } from '@umber-fixtures/shared/bootScript'
import { darkClass, lightClass, style } from '@umber-fixtures/shared/style'
import { extractPageStyles } from '@umber-style/core'
import { renderToString } from 'react-dom/server'
import { dangerouslySkipEscape, escapeInject } from 'vike/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import { PageShell } from './PageShell'

// The approach of docs/server-rendering.md: render, then ask the cache for the CSS of this page.
export const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
  const { Page } = pageContext
  const html = renderToString(
    <PageShell>
      <Page />
    </PageShell>
  )
  // The themes of <html> and the one it can switch to are not in the markup of the page.
  const { tag: styleTag } = extractPageStyles(style.cache, html, {
    themes: [lightClass, darkClass],
  })
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
