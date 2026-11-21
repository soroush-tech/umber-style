import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', 'create-instance': 'src/createInstance.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The default export of create-instance stays `exports.default` in CommonJS, as its declarations say.
  cjsDefault: false,
})
