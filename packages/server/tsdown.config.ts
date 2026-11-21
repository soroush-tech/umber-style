import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { createInstance: 'src/createInstance.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  // The default export stays `default` in the CommonJS build too, as its declarations say.
  cjsDefault: false,
  clean: true,
})
