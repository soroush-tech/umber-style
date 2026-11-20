import { defineConfig } from 'tsdown'

// `@umber-style/react` is a dependency, not bundled: the consumer resolves it, so the `react-server`
// condition of that package still picks its server build.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  // The default export stays `default` in the CommonJS build too, as its declarations say.
  cjsDefault: false,
  clean: true,
})
