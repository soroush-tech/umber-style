// The document of jsdom that the files of the core which need a DOM run in: the sandbox has no DOM of its
// own. The cache watches its page with the global `MutationObserver`, which Node lacks, so jsdom's is put
// there. jsdom has no types of its own here: the one constructor used is typed by hand.
import { createRequire } from 'node:module'

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis }
}

/** The window of the one document of the process. */
export const { window } = new JSDOM('<!doctype html><html><head></head><body></body></html>')
Object.assign(globalThis, { MutationObserver: window.MutationObserver })
