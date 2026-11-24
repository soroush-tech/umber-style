// The globals the animation library reads when its mock is loaded: `__DEV__`, which its bundler defines,
// and `matchMedia`, which it asks for the system's reduced motion on the web and jsdom does not have. A
// test file that runs in Node has no window, and loads no library.
const globals = globalThis as Record<string, unknown>
globals.__DEV__ = true
if (typeof window !== 'undefined') {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
