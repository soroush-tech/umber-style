// The document of jsdom that the Vue files which render into a DOM run in, made before Vue loads: Vue's
// runtime reads `document` as it starts. A file imports this module first, then `fixtures.ts` (which
// loads Vue and the built binding). jsdom has no types of its own here: the one constructor used is typed
// by hand.
import { createRequire } from 'node:module'

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis }
}
const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>')
Object.assign(globalThis, {
  window,
  document: window.document,
  MutationObserver: window.MutationObserver,
  // Vue's `mount` asks what kind of element the container is.
  Element: window.Element,
  SVGElement: window.SVGElement,
})

export const { document } = window
