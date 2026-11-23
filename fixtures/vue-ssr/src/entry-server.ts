import { createBootScript } from '@umber-fixtures/shared/bootScript'
import { extractPageStyles } from '@umber-style/core'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createApp } from './app'
import { darkClass, lightClass, style } from './style'

// The approach of docs/server-rendering.md for Vue: render, then ask the cache for the CSS of this page.
/** Renders the page at `url`: its HTML, the style element of its CSS (with the nonce of the request), the boot script and the class of `<html>`. */
export async function render(url: string, nonce: string) {
  const app = createSSRApp(createApp(url))
  const html = await renderToString(app)
  return {
    html,
    styleTag: extractPageStyles(style.cache, html, { themes: [lightClass, darkClass], nonce }).tag,
    boot: createBootScript(lightClass, darkClass),
    htmlClass: lightClass,
  }
}
