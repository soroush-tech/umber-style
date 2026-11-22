import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { react: 'src/react.ts', vue: 'src/vue.ts', 'react-native': 'src/react-native.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  // The default export of each entry stays `exports.default` in CommonJS, as its declarations say.
  cjsDefault: false,
  clean: true,
})
