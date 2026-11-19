import { bootScript } from '@umber-fixtures/shared/bootScript'
import { createStyleTag } from '@umber-style/core'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createApp } from './app'
import { darkClass, lightClass, style } from './style'

// The approach of docs/server-rendering.md for Vue: render, then ask the cache for what it holds.
export async function render(url: string) {
  const app = createSSRApp(createApp(url))
  const html = await renderToString(app)
  return {
    html,
    styleTag: createStyleTag(style.cache),
    boot: bootScript(lightClass, darkClass),
    htmlClass: lightClass,
  }
}
