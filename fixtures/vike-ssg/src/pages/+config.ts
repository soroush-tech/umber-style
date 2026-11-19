import type { Config } from 'vike/types'

// Every page is prerendered to HTML at build time, then the app moves between pages in the browser.
export default {
  prerender: true,
  clientRouting: true,
  hydrationCanBeAborted: true,
} satisfies Config
